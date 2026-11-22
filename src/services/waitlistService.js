// Waitlist: patients wait for a doctor's day when their slot (or the whole
// day) is full; the worker books the first suitable patient when a
// cancellation frees a slot on that day.
const { randomUUID } = require('node:crypto');
const patientModel = require('../models/patientModel');
const doctorModel = require('../models/doctorModel');
const appointmentModel = require('../models/appointmentModel');
const { MAX_APPOINTMENTS_PER_DAY } = require('../config/businessRules');
const { validateSlot } = require('../utils/slotValidator');
const { parseLocalDate, addDays } = require('../utils/dateTime');
const AppError = require('../utils/AppError');
const auditLogger = require('../utils/auditLogger');
const waitlistStore = require('../queues/waitlistStore');
const { bookAppointment, slotValidationError } = require('./bookingService');

// Errors that mean "this patient can't take this slot, but the next one might".
const PATIENT_SPECIFIC_ERRORS = new Set(['PATIENT_CONFLICT']);
// Errors that mean "the slot itself is no longer available to anyone".
const SLOT_UNAVAILABLE_ERRORS = new Set(['SLOT_TAKEN', 'DAY_FULL', 'SLOT_IN_PAST', 'DOCTOR_NOT_FOUND']);

async function withRedis(operation) {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error(`[waitlist] Redis error: ${err.message}`);
    throw AppError.serviceUnavailable('The waitlist is temporarily unavailable, please try again shortly', 'WAITLIST_UNAVAILABLE');
  }
}

// Waitlist keys expire at the end of the day after the appointment day.
function expiryFor(day) {
  return Math.floor(addDays(parseLocalDate(day), 2).getTime() / 1000);
}

async function joinWaitlist({ patientId, doctorId, appointmentDatetime, now = new Date() }) {
  const check = validateSlot(appointmentDatetime, now);
  if (!check.ok) throw slotValidationError(check);
  const { slot } = check;

  const [patient, doctor] = await Promise.all([patientModel.findById(patientId), doctorModel.findById(doctorId)]);
  if (!patient) throw AppError.notFound(`Patient ${patientId} not found`, 'PATIENT_NOT_FOUND');
  if (!doctor) throw AppError.notFound(`Doctor ${doctorId} not found`, 'DOCTOR_NOT_FOUND');

  const [slotTaken, bookedThatDay, alreadyBooked] = await Promise.all([
    appointmentModel.isSlotTaken(doctorId, slot.datetime),
    appointmentModel.countBookedForDoctorOnDay(doctorId, slot.day),
    appointmentModel.patientHasAppointmentWithDoctorOnDay(patientId, doctorId, slot.day),
  ]);

  if (alreadyBooked) {
    throw AppError.conflict('The patient already has an appointment with this doctor on that day', 'ALREADY_BOOKED');
  }
  if (!slotTaken && bookedThatDay < MAX_APPOINTMENTS_PER_DAY) {
    throw AppError.unprocessable('That slot is still available - book it directly with POST /api/appointments', 'SLOT_AVAILABLE');
  }

  const entry = {
    id: randomUUID(),
    patientId,
    doctorId,
    day: slot.day,
    requestedDatetime: slot.datetime,
    joinedAt: now.toISOString(),
  };

  const result = await withRedis(() => waitlistStore.add(entry, expiryFor(slot.day)));
  if (!result.added) {
    throw AppError.conflict('The patient is already on the waitlist for this doctor and day', 'ALREADY_WAITLISTED');
  }

  await auditLogger.log('WAITLIST_JOINED', { ...entry, position: result.position });
  return { ...entry, position: result.position };
}

async function getWaitlist(doctorId, day) {
  if (!(await doctorModel.findById(doctorId))) {
    throw AppError.notFound(`Doctor ${doctorId} not found`, 'DOCTOR_NOT_FOUND');
  }
  const entries = await withRedis(() => waitlistStore.list(doctorId, day));
  return entries.map(({ entry }, index) => ({ position: index + 1, ...entry }));
}

// A patient leaves a waitlist (e.g. they found another appointment).
async function leaveWaitlist({ doctorId, day, patientId }) {
  const [patient, doctor] = await Promise.all([patientModel.findById(patientId), doctorModel.findById(doctorId)]);
  if (!patient) throw AppError.notFound(`Patient ${patientId} not found`, 'PATIENT_NOT_FOUND');
  if (!doctor) throw AppError.notFound(`Doctor ${doctorId} not found`, 'DOCTOR_NOT_FOUND');

  const removed = await withRedis(() => waitlistStore.removePatient(doctorId, day, patientId));
  if (!removed) {
    throw AppError.notFound(`Patient ${patientId} is not on the waitlist for doctor ${doctorId} on ${day}`, 'NOT_ON_WAITLIST');
  }
  await auditLogger.log('WAITLIST_LEFT', { patientId, doctorId, day });
}

// Called by the worker for a SLOT_FREED job.
//
// Failure handling - a patient must never vanish from both the waitlist and
// the appointments table:
//   * Entries are only READ while trying; an entry is removed from Redis
//     only AFTER its appointment row has been committed.
//   * If the booking throws an unexpected error (DB down, deadlock...), the
//     entry is still in the list and the error is re-thrown so the job is
//     retried later.
//   * If the worker crashes between COMMIT and removal, the patient is in
//     both places; the next run sees they are already booked and removes the
//     stale entry. "In both" is recoverable - "in neither" cannot happen.
async function promoteFromWaitlist({ doctorId, day, appointmentDatetime }, { now = new Date() } = {}) {
  const entries = await waitlistStore.list(doctorId, day);

  for (const { raw, entry } of entries) {
    // The patient may have left the waitlist after the list was read.
    if (!(await waitlistStore.isWaiting(doctorId, day, entry.patientId))) continue;

    const patient = await patientModel.findById(entry.patientId);
    if (!patient) {
      await waitlistStore.remove(doctorId, day, raw, entry.patientId);
      await auditLogger.log('WAITLIST_REMOVED', { ...entry, reason: 'PATIENT_DELETED' });
      continue;
    }

    if (await appointmentModel.patientHasAppointmentWithDoctorOnDay(entry.patientId, doctorId, day)) {
      await waitlistStore.remove(doctorId, day, raw, entry.patientId);
      await auditLogger.log('WAITLIST_REMOVED', { ...entry, reason: 'ALREADY_BOOKED' });
      continue;
    }

    try {
      const appointment = await bookAppointment({
        patientId: entry.patientId,
        doctorId,
        appointmentDatetime,
        now,
        source: 'WAITLIST',
      });
      await waitlistStore.remove(doctorId, day, raw, entry.patientId);
      await auditLogger.log('WAITLIST_PROMOTED', { ...entry, appointmentId: appointment.id, appointmentDatetime });
      return { promoted: entry, appointment };
    } catch (err) {
      if (PATIENT_SPECIFIC_ERRORS.has(err.code)) {
        // Keep their place for a later slot and offer this one to the next patient.
        await auditLogger.log('WAITLIST_SKIPPED', { ...entry, appointmentDatetime, reason: err.code });
        continue;
      }
      if (SLOT_UNAVAILABLE_ERRORS.has(err.code)) {
        // Someone booked the slot directly first, or it is now in the past.
        await auditLogger.log('WAITLIST_NOT_PROMOTED', { doctorId, day, appointmentDatetime, reason: err.code });
        return { promoted: null, reason: err.code };
      }
      throw err; // unexpected -> job retry; the entry is still in the waitlist
    }
  }

  return { promoted: null, reason: entries.length === 0 ? 'WAITLIST_EMPTY' : 'NO_ELIGIBLE_PATIENT' };
}

module.exports = { joinWaitlist, getWaitlist, leaveWaitlist, promoteFromWaitlist };
