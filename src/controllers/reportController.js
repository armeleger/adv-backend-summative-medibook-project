const reportModel = require('../models/reportModel');
const { MAX_APPOINTMENTS_PER_DAY, BUSY_DAY_THRESHOLD } = require('../config/businessRules');

// GET /api/reports/doctors
async function doctorsReport(req, res) {
  res.json({ data: await reportModel.getDoctorsReport() });
}

// GET /api/reports/busy-days
async function busyDaysReport(req, res) {
  const rows = await reportModel.getBusyDays({ dailyCap: MAX_APPOINTMENTS_PER_DAY, threshold: BUSY_DAY_THRESHOLD });
  res.json({
    criteria: {
      dailyCap: MAX_APPOINTMENTS_PER_DAY,
      thresholdPercent: BUSY_DAY_THRESHOLD * 100,
      rule: `more than ${BUSY_DAY_THRESHOLD * 100}% of ${MAX_APPOINTMENTS_PER_DAY} slots booked`,
    },
    data: rows,
  });
}

module.exports = { doctorsReport, busyDaysReport };
