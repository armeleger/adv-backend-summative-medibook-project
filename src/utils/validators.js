// Request payload validation. Each validator returns { errors, value } where
// `value` holds only known, cleaned fields - never the raw request body.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/;
const MAX_MONEY = 99999999.99; // DECIMAL(10,2)

// ---- field checkers: (raw, field) -> { value } | { error } -----------------

const text = (min, max) => (raw, field) => {
  if (typeof raw !== 'string') return { error: `${field} must be a string` };
  const value = raw.trim();
  if (value.length < min || value.length > max) {
    return { error: `${field} must be between ${min} and ${max} characters` };
  }
  return { value };
};

const email = (raw, field) => {
  if (typeof raw !== 'string') return { error: `${field} must be a string` };
  const value = raw.trim().toLowerCase();
  if (value.length > 255 || !EMAIL_PATTERN.test(value)) {
    return { error: `${field} must be a valid email address` };
  }
  return { value };
};

const phone = (raw, field) => {
  if (typeof raw !== 'string' || !PHONE_PATTERN.test(raw.trim())) {
    return { error: `${field} must be a phone number of 7-20 digits (spaces, dashes and a leading + allowed)` };
  }
  return { value: raw.trim() };
};

const money = (raw, field) => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { error: `${field} must be a number` };
  if (raw < 0 || raw > MAX_MONEY) return { error: `${field} must be between 0 and ${MAX_MONEY}` };
  const cents = raw * 100;
  if (Math.abs(cents - Math.round(cents)) > 1e-6) return { error: `${field} can have at most 2 decimal places` };
  return { value: Math.round(cents) / 100 };
};

const positiveInt = (raw, field) => {
  if (!Number.isInteger(raw) || raw < 1) return { error: `${field} must be a positive integer` };
  return { value: raw };
};

const anyString = (raw, field) => (typeof raw === 'string' ? { value: raw } : { error: `${field} must be a string` });

// ---- schemas ---------------------------------------------------------------

const PATIENT_SCHEMA = { fullName: text(2, 100), email, phone };

const DOCTOR_SCHEMA = {
  fullName: text(2, 100),
  specialty: text(2, 100),
  consultationFee: money,
  room: text(1, 10),
};

// appointmentDatetime is only type-checked here; slot rules (future, working
// hours, 30-minute boundary) live in slotValidator.
const BOOKING_SCHEMA = { patientId: positiveInt, doctorId: positiveInt, appointmentDatetime: anyString };

// ---- engine ----------------------------------------------------------------

// partial = true for PATCH: missing fields are fine, but at least one is needed.
function validateAgainst(schema, body, { partial = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object'], value: {} };
  }

  const errors = [];
  const value = {};

  const unknown = Object.keys(body).filter((key) => !Object.hasOwn(schema, key));
  if (unknown.length > 0) errors.push(`Unknown field(s): ${unknown.join(', ')}`);

  for (const [field, check] of Object.entries(schema)) {
    if (body[field] === undefined || body[field] === null) {
      if (!partial) errors.push(`${field} is required`);
      continue;
    }
    const result = check(body[field], field);
    if (result.error) errors.push(result.error);
    else value[field] = result.value;
  }

  if (partial && errors.length === 0 && Object.keys(value).length === 0) {
    errors.push(`Provide at least one of: ${Object.keys(schema).join(', ')}`);
  }

  return { errors, value };
}

// "42" -> 42; anything else (0, -1, "4x", "1.5") -> null
function parsePositiveInt(raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw > 0 ? raw : null;
  if (typeof raw !== 'string' || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const value = Number(raw);
  return value <= 4294967295 ? value : null; // INT UNSIGNED max
}

module.exports = {
  validatePatient: (body, options) => validateAgainst(PATIENT_SCHEMA, body, options),
  validateDoctor: (body, options) => validateAgainst(DOCTOR_SCHEMA, body, options),
  validateBooking: (body) => validateAgainst(BOOKING_SCHEMA, body),
  parsePositiveInt,
};
