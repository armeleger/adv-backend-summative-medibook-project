// Booking workflow shared by the API (POST /api/appointments) and the worker
// (waitlist promotion), so every booking path enforces the same rules.
const { withTransaction } = require('../models/db');
const doctorModel = require('../models/doctorModel');
const patientModel = require('../models/patientModel');
const appointmentModel = require('../models/appointmentModel');
const { MAX_APPOINTMENTS_PER_DAY } = require('../config/businessRules');
const { validateSlot } = require('../utils/slotValidator');
const AppError = require('../utils/AppError');
const auditLogger = require('../utils/auditLogger');
const jobQueue = require('../queues/jobQueue');

// Which UNIQUE index a duplicate-key error came from -> what it means.
const DUPLICATE_KEY_ERRORS = {
  uq_doctor_active_slot: (request) => slotUnavailable('SLOT_TAKEN', 'This doctor already has an appointment at that time', request),
  uq_patient_active_slot: () => AppError.conflict('The patient already has another appointment at that time', 'PATIENT_CONFLICT'),
};

function slotValidationError(check) {
  return new AppError(check.status, check.message, { code: check.code });
}

// 409 that also offers the waitlist (Part E).
function slotUnavailable(code, message, request) {
  return AppError.conflict(message, code, {
    waitlist: {
      offered: true,
      message: 'Join the waitlist and you will be booked automatically if a slot frees up that day.',
      method: 'POST',
      path: '/api/waitlist',
      ...(request && { body: request }),
    },
  });
}

function translateDuplicateKey(err, request) {
  const match = Object.keys(DUPLICATE_KEY_ERRORS).find((key) => err.sqlMessage?.includes(key));
  return match ? DUPLICATE_KEY_ERRORS[match](request) : err;
}

async function bookAppointment({ patientId, doctorId, appointmentDatetime, now = new Date(), source = 'API' }) {
  const check = validateSlot(appointmentDatetime, now);
  if (!check.ok) throw slotValidationError(check);
  const { slot } = check;
  const request = { patientId, doctorId, appointmentDatetime: slot.datetime };

  // READ COMMITTED: every SELECT below sees rows committed by the booking
  // that held the doctor lock before us (not an older snapshot).
  const appointmentId = await withTransaction(async (connection) => {
    // 1. Lock the doctor row FIRST. Concurrent bookings for this doctor queue
    //    up here, so the slot check and the daily count below cannot race.
    const doctor = await doctorModel.findByIdForUpdate(doctorId, connection);
    if (!doctor) throw AppError.notFound(`Doctor ${doctorId} not found`, 'DOCTOR_NOT_FOUND');

    const patient = await patientModel.findById(patientId, connection);
    if (!patient) throw AppError.notFound(`Patient ${patientId} not found`, 'PATIENT_NOT_FOUND');

    // 2. Slot still free?
    if (await appointmentModel.isSlotTaken(doctorId, slot.datetime, connection)) {
      throw slotUnavailable('SLOT_TAKEN', 'This doctor already has an appointment at that time', request);
    }

    // 3. Daily cap.
    const bookedThatDay = await appointmentModel.countBookedForDoctorOnDay(doctorId, slot.day, connection);
    if (bookedThatDay >= MAX_APPOINTMENTS_PER_DAY) {
      throw slotUnavailable('DAY_FULL',
        `${doctor.fullName} already has the maximum of ${MAX_APPOINTMENTS_PER_DAY} appointments on ${slot.day}`,
        request);
    }

    // 4. Patient cannot be in two places at once.
    if (await appointmentModel.patientHasAppointmentAt(patientId, slot.datetime, connection)) {
      throw AppError.conflict('The patient already has another appointment at that time', 'PATIENT_CONFLICT');
    }

    // 5. Insert. The fee is taken from the doctor row server-side, never from
    //    the client. The UNIQUE indexes are the last line of defence.
    try {
      return await appointmentModel.create(
        { patientId, doctorId, datetime: slot.datetime, amountPaid: doctor.consultationFee },
        connection,
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw translateDuplicateKey(err, request);
      throw err;
    }
  }, { isolationLevel: 'READ COMMITTED' });

  // After COMMIT: side effects that must not undo the booking if they fail.
  const appointment = await appointmentModel.findById(appointmentId);
  await auditLogger.log('APPOINTMENT_BOOKED', {
    appointmentId,
    patientId,
    doctorId,
    appointmentDatetime: appointment.appointmentDatetime,
    amountPaid: appointment.amountPaid,
    source,
  });
  await jobQueue.enqueue(jobQueue.JOB_TYPES.SEND_CONFIRMATION, { appointmentId });

  return appointment;
}

module.exports = { bookAppointment, slotValidationError };
