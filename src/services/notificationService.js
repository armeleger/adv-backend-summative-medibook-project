// "Sends" appointment confirmations. No real SMS/email provider: the worker
// writes the message it would send to the audit log.
const appointmentModel = require('../models/appointmentModel');
const { APPOINTMENT_STATUS } = require('../config/businessRules');
const auditLogger = require('../utils/auditLogger');

function buildConfirmationMessage(appointment) {
  return `Hello ${appointment.patientName}, your appointment with ${appointment.doctorName} `
    + `(${appointment.specialty}, room ${appointment.room}) on ${appointment.appointmentDatetime.slice(0, 16)} is confirmed. `
    + `Amount paid: ${appointment.amountPaid.toFixed(2)}. Ref: AP-${String(appointment.id).padStart(3, '0')}.`;
}

async function sendConfirmation({ appointmentId }) {
  const appointment = await appointmentModel.findById(appointmentId);
  if (!appointment || appointment.status !== APPOINTMENT_STATUS.BOOKED) {
    // Deleted or cancelled before the job ran - nothing to confirm.
    await auditLogger.log('CONFIRMATION_SKIPPED', { appointmentId, reason: appointment ? 'CANCELLED' : 'NOT_FOUND' });
    return;
  }
  const message = buildConfirmationMessage(appointment);
  await auditLogger.log('CONFIRMATION_SENT', {
    appointmentId,
    channels: { sms: appointment.patientPhone, email: appointment.patientEmail },
    message,
  });
}

module.exports = { sendConfirmation, buildConfirmationMessage };
