// Date helpers. Appointment times are clinic wall-clock times: MySQL DATETIME
// has no timezone, and the app runs with TZ set to the clinic's timezone, so
// local-time Date components map one-to-one onto stored values.

const MS_PER_HOUR = 60 * 60 * 1000;

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n) => String(n).padStart(2, '0');

// Builds a local Date and rejects impossible values (2026-02-30, 25:00, ...)
// by checking that JavaScript did not roll the components over.
function buildLocalDate(year, month, day, hours = 0, minutes = 0, seconds = 0) {
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  const isExact =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes &&
    date.getSeconds() === seconds;
  return isExact ? date : null;
}

// "2026-08-10T09:30", "2026-08-10 09:30" or "2026-08-10 09:30:00" -> Date | null
function parseLocalDateTime(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  // The seconds group is optional, so it may be undefined -> 0.
  const [year, month, day, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0));
  return buildLocalDate(year, month, day, hours, minutes, seconds);
}

// "2026-08-10" -> Date at local midnight | null
function parseLocalDate(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  return buildLocalDate(year, month, day);
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Date -> "YYYY-MM-DD HH:mm:ss", the format MySQL DATETIME uses.
function formatDateTime(date) {
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// "HH:mm" -> minutes since midnight
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}

module.exports = {
  MS_PER_HOUR,
  parseLocalDateTime,
  parseLocalDate,
  formatDate,
  formatDateTime,
  addDays,
  startOfDay,
  timeToMinutes,
  minutesToTime,
};
