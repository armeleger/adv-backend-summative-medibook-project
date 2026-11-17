const appointmentModel = require('../models/appointmentModel');
const { APPOINTMENT_STATUS } = require('../config/businessRules');
const { bookAppointment } = require('../services/bookingService');
const { cancelAppointment } = require('../services/cancellationService');
const { validateBooking } = require('../utils/validators');
const AppError = require('../utils/AppError');
const { requireId, optionalId, optionalDate, assertValid } = require('./requestHelpers');

// POST /api/appointments
async function createAppointment(req, res) {
  const booking = assertValid(validateBooking(req.body));
  const appointment = await bookAppointment(booking);
  res.status(201).location(`/api/appointments/${appointment.id}`).json({ data: appointment });
}

// GET /api/appointments?patientId=&doctorId=&date=&status=
async function listAppointments(req, res) {
  const { status } = req.query;
  if (status !== undefined && !Object.values(APPOINTMENT_STATUS).includes(status)) {
    throw AppError.badRequest(`status must be one of: ${Object.values(APPOINTMENT_STATUS).join(', ')}`);
  }
  const filters = {
    patientId: optionalId(req.query.patientId, 'patientId'),
    doctorId: optionalId(req.query.doctorId, 'doctorId'),
    date: optionalDate(req.query.date, 'date'),
    status,
  };
  res.json({ data: await appointmentModel.findAll(filters) });
}

// GET /api/appointments/:id
async function getAppointment(req, res) {
  const id = requireId(req.params.id);
  const appointment = await appointmentModel.findById(id);
  if (!appointment) throw AppError.notFound(`Appointment ${id} not found`);
  res.json({ data: appointment });
}

// DELETE /api/appointments/:id
// Cancels the booking. The row is kept with status CANCELLED and its refund,
// so the response is 200 with the refund details rather than 204.
async function deleteAppointment(req, res) {
  const id = requireId(req.params.id);
  const { appointment, refund } = await cancelAppointment(id);
  res.json({
    data: appointment,
    refund: {
      ...refund,
      message: `Appointment cancelled with ${refund.hoursNotice} hours notice: refund of ${refund.refundAmount.toFixed(2)} (${refund.refundPercent}%)`,
    },
  });
}

module.exports = { createAppointment, listAppointments, getAppointment, deleteAppointment };
