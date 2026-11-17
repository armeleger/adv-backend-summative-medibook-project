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

module.exports = { joinWaitlist, getWaitlist };
