// Single source of truth for MediBook's business values.
// (database/schema.sql mirrors the slot rules as CHECK constraints so the
// database rejects bad rows even if application code is bypassed.)

const WORKING_HOURS = Object.freeze({ start: '09:00', end: '17:00' });

const SLOT_MINUTES = 30;

const MAX_APPOINTMENTS_PER_DAY = 12;

// Refund policy, by hours of notice before the appointment:
//   notice  > 48h          -> 100%
//   24h <= notice <= 48h   ->  50%   (both boundaries fall in the middle tier)
//   notice  < 24h          ->   0%
const REFUND_POLICY = Object.freeze({
  fullRefundAboveHours: 48,
  partialRefundFromHours: 24,
  fullRefundPercent: 100,
  partialRefundPercent: 50,
  noRefundPercent: 0,
});

// A doctor-day is "busy" when MORE than 80% of the daily cap is booked.
const BUSY_DAY_THRESHOLD = 0.8;

// The doctor statistics endpoint reports on today + the following 6 days.
const STATS_WINDOW_DAYS = 7;

const APPOINTMENT_STATUS = Object.freeze({
  BOOKED: 'BOOKED',
  CANCELLED: 'CANCELLED',
});

module.exports = {
  WORKING_HOURS,
  SLOT_MINUTES,
  MAX_APPOINTMENTS_PER_DAY,
  REFUND_POLICY,
  BUSY_DAY_THRESHOLD,
  STATS_WINDOW_DAYS,
  APPOINTMENT_STATUS,
};
