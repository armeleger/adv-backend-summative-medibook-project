// Pure validation of a requested appointment slot. No database access, so it
// can be unit tested and reused by both the API and the worker.
const { WORKING_HOURS, SLOT_MINUTES } = require('../config/businessRules');
const { parseLocalDateTime, formatDate, formatDateTime, timeToMinutes, minutesToTime } = require('./dateTime');

const DAY_START = timeToMinutes(WORKING_HOURS.start);
const DAY_END = timeToMinutes(WORKING_HOURS.end);
const LAST_SLOT_START = DAY_END - SLOT_MINUTES;

function failure(status, code, message) {
  return { ok: false, status, code, message };
}

// Returns { ok: true, slot } or { ok: false, status, code, message }.
//   400 -> the value is not a readable date-time at all
//   422 -> a real date-time that breaks a booking rule
function validateSlot(value, now = new Date()) {
  const date = parseLocalDateTime(value);
  if (!date) {
    return failure(400, 'INVALID_DATETIME',
      'appointmentDatetime must be a valid date-time in the format YYYY-MM-DDTHH:mm (clinic local time)');
  }

  const minuteOfDay = date.getHours() * 60 + date.getMinutes();

  if (date.getSeconds() !== 0 || minuteOfDay % SLOT_MINUTES !== 0) {
    return failure(422, 'NOT_ON_SLOT_BOUNDARY',
      `Appointments start on ${SLOT_MINUTES}-minute boundaries (e.g. ${WORKING_HOURS.start}, ${minutesToTime(DAY_START + SLOT_MINUTES)})`);
  }

  if (minuteOfDay < DAY_START || minuteOfDay > LAST_SLOT_START) {
    return failure(422, 'OUTSIDE_WORKING_HOURS',
      `Working hours are ${WORKING_HOURS.start}-${WORKING_HOURS.end}; the last appointment starts at ${minutesToTime(LAST_SLOT_START)}`);
  }

  if (date.getTime() <= now.getTime()) {
    return failure(422, 'SLOT_IN_PAST', 'Appointments can only be booked in the future');
  }

  return {
    ok: true,
    slot: { date, datetime: formatDateTime(date), day: formatDate(date) },
  };
}

// All slot start times in a working day: ["09:00", "09:30", ..., "16:30"]
function listDailySlotTimes() {
  const times = [];
  for (let minute = DAY_START; minute <= LAST_SLOT_START; minute += SLOT_MINUTES) {
    times.push(minutesToTime(minute));
  }
  return times;
}

module.exports = { validateSlot, listDailySlotTimes };
