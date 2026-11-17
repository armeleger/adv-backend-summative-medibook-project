// Small helpers shared by controllers for turning request input into
// validated values (or a 400).
const AppError = require('../utils/AppError');
const { parsePositiveInt } = require('../utils/validators');
const { parseLocalDate } = require('../utils/dateTime');

function requireId(raw, name = 'id') {
  const id = parsePositiveInt(raw);
  if (id === null) throw AppError.badRequest(`${name} must be a positive integer`);
  return id;
}

function optionalId(raw, name) {
  return raw === undefined ? undefined : requireId(raw, name);
}

function requireDate(raw, name = 'date') {
  if (typeof raw !== 'string' || !parseLocalDate(raw)) {
    throw AppError.badRequest(`${name} must be a valid date in the format YYYY-MM-DD`);
  }
  return raw;
}

function optionalDate(raw, name) {
  return raw === undefined ? undefined : requireDate(raw, name);
}

// Unwraps a validator result, or throws a 400 listing every problem.
function assertValid({ errors, value }) {
  if (errors.length > 0) throw AppError.badRequest('Validation failed', errors);
  return value;
}

module.exports = { requireId, optionalId, requireDate, optionalDate, assertValid };
