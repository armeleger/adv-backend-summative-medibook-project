const waitlistService = require('../services/waitlistService');
const { validateBooking } = require('../utils/validators');
const { requireId, requireDate, assertValid } = require('./requestHelpers');

// POST /api/waitlist  { patientId, doctorId, appointmentDatetime }
async function joinWaitlist(req, res) {
  const request = assertValid(validateBooking(req.body));
  const entry = await waitlistService.joinWaitlist(request);
  res.status(201).json({
    data: entry,
    message: `Added to the waitlist at position ${entry.position}. If a slot frees up on ${entry.day}, the patient is booked automatically.`,
  });
}

// GET /api/waitlist?doctorId=&date=
async function getWaitlist(req, res) {
  const doctorId = requireId(req.query.doctorId, 'doctorId');
  const day = requireDate(req.query.date);
  res.json({ data: await waitlistService.getWaitlist(doctorId, day) });
}

// DELETE /api/waitlist/:doctorId/:date/:patientId
// A waitlist entry is identified by its natural key: one doctor, one day,
// one patient (a patient can be on a given doctor-day waitlist only once).
async function leaveWaitlist(req, res) {
  await waitlistService.leaveWaitlist({
    doctorId: requireId(req.params.doctorId, 'doctorId'),
    day: requireDate(req.params.date),
    patientId: requireId(req.params.patientId, 'patientId'),
  });
  res.status(204).end();
}

module.exports = { joinWaitlist, getWaitlist, leaveWaitlist };
