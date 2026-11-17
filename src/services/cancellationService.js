// Cancellation workflow: compute the refund on the server, record the
// cancellation + refund atomically, then notify the waitlist.
const { withTransaction } = require('../models/db');
const appointmentModel = require('../models/appointmentModel');
const { APPOINTMENT_STATUS } = require('../config/businessRules');
const { calculateRefund } = require('../utils/refundCalculator');
const { parseLocalDateTime, formatDateTime, formatDate } = require('../utils/dateTime');
const AppError = require('../utils/AppError');
const auditLogger = require('../utils/auditLogger');
const jobQueue = require('../queues/jobQueue');

async function cancelAppointment(appointmentId, { now = new Date() } = {}) {
  const { booking, refund } = await withTransaction(async (connection) => {
    // Row lock: two simultaneous cancellations of the same appointment are
    // serialized; the second one sees CANCELLED and gets a 409.
    const booking = await appointmentModel.findByIdForUpdate(appointmentId, connection);
    if (!booking) throw AppError.notFound(`Appointment ${appointmentId} not found`);

    if (booking.status === APPOINTMENT_STATUS.CANCELLED) {
      throw AppError.conflict('This appointment has already been cancelled', 'ALREADY_CANCELLED');
    }

    const appointmentTime = parseLocalDateTime(booking.appointmentDatetime);
    if (appointmentTime.getTime() <= now.getTime()) {
      throw AppError.unprocessable('Appointments that have already started or passed cannot be cancelled', 'APPOINTMENT_IN_PAST');
    }

    const refund = calculateRefund({ amountPaid: booking.amountPaid, appointmentTime, cancelledAt: now });

    // One UPDATE writes the status AND the refund: both or neither.
    const updated = await appointmentModel.markCancelled(
      appointmentId,
      { cancelledAt: formatDateTime(now), refundPercent: refund.refundPercent, refundAmount: refund.refundAmount },
      connection,
    );
    if (!updated) throw AppError.conflict('This appointment has already been cancelled', 'ALREADY_CANCELLED');

    return { booking, refund };
  });

  // After COMMIT. The row is kept (status CANCELLED) for refund history; the
  // partial UNIQUE index no longer covers it, so the slot is bookable again.
  const appointment = await appointmentModel.findById(appointmentId);
  await auditLogger.log('APPOINTMENT_CANCELLED', {
    appointmentId,
    patientId: booking.patientId,
    doctorId: booking.doctorId,
    appointmentDatetime: booking.appointmentDatetime,
    amountPaid: booking.amountPaid,
    ...refund,
  });
  await jobQueue.enqueue(jobQueue.JOB_TYPES.SLOT_FREED, {
    doctorId: booking.doctorId,
    day: formatDate(parseLocalDateTime(booking.appointmentDatetime)),
    appointmentDatetime: booking.appointmentDatetime,
  });

  return { appointment, refund };
}

module.exports = { cancelAppointment };
