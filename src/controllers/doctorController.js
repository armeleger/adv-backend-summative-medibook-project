const doctorModel = require('../models/doctorModel');
const appointmentModel = require('../models/appointmentModel');
const reportModel = require('../models/reportModel');
const { MAX_APPOINTMENTS_PER_DAY, STATS_WINDOW_DAYS } = require('../config/businessRules');
const { validateDoctor } = require('../utils/validators');
const { describeDaySlots } = require('../utils/slotValidator');
const { formatDate, formatDateTime, startOfDay, addDays } = require('../utils/dateTime');
const { createCrudController } = require('./crudControllerFactory');
const { requireId, requireDate, optionalDate } = require('./requestHelpers');

const crud = createCrudController({
  model: doctorModel,
  validate: validateDoctor,
  resourceName: 'Doctor',
  basePath: '/api/doctors',
});

// GET /api/doctors/:id/stats
// Revenue, upcoming count, and per-day counts + utilization for today and
// the next 6 days. The figures are computed by SQL in reportModel.
async function getStats(req, res) {
  const doctorId = requireId(req.params.id);
  await crud.findOr404(doctorId);

  const now = new Date();
  const windowStartDate = startOfDay(now);
  const window = {
    doctorId,
    now: formatDateTime(now),
    windowStart: formatDate(windowStartDate),
    windowEnd: formatDate(addDays(windowStartDate, STATS_WINDOW_DAYS)),
    windowDays: STATS_WINDOW_DAYS,
    dailyCap: MAX_APPOINTMENTS_PER_DAY,
  };

  const [summary, days] = await Promise.all([
    reportModel.getDoctorSummary(window),
    reportModel.getDoctorDailyCounts(window),
  ]);

  res.json({
    data: {
      doctorId: summary.doctorId,
      doctorName: summary.doctorName,
      specialty: summary.specialty,
      revenueCollected: summary.revenueCollected,
      upcomingAppointments: summary.upcomingAppointments,
      next7Days: {
        from: window.windowStart,
        to: formatDate(addDays(windowStartDate, STATS_WINDOW_DAYS - 1)),
        dailyCap: MAX_APPOINTMENTS_PER_DAY,
        bookedAppointments: summary.bookedInWindow,
        capacity: MAX_APPOINTMENTS_PER_DAY * STATS_WINDOW_DAYS,
        utilizationPercent: summary.utilizationPercent,
        perDay: days,
      },
    },
  });
}

// GET /api/doctors/:id/availability?date=YYYY-MM-DD
// Lists every slot of the day with its status: available, booked, past or
// day_full.
async function getAvailability(req, res) {
  const doctorId = requireId(req.params.id);
  const day = requireDate(req.query.date);
  await crud.findOr404(doctorId);

  const bookedTimes = new Set(await appointmentModel.findBookedTimesForDoctorOnDay(doctorId, day));
  const dayFull = bookedTimes.size >= MAX_APPOINTMENTS_PER_DAY;

  res.json({
    data: {
      doctorId,
      date: day,
      bookedAppointments: bookedTimes.size,
      dailyCap: MAX_APPOINTMENTS_PER_DAY,
      dayFull,
      slots: describeDaySlots(day, bookedTimes, dayFull),
    },
  });
}

// GET /api/doctors/:id/appointments?date=YYYY-MM-DD
async function listAppointments(req, res) {
  const doctorId = requireId(req.params.id);
  const date = optionalDate(req.query.date, 'date');
  await crud.findOr404(doctorId);
  res.json({ data: await appointmentModel.findAll({ doctorId, date }) });
}

module.exports = {
  listDoctors: crud.list,
  getDoctor: crud.getOne,
  createDoctor: crud.create,
  replaceDoctor: crud.replace,
  updateDoctor: crud.modify,
  deleteDoctor: crud.remove,
  getStats,
  getAvailability,
  listAppointments,
};
