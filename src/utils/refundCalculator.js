// Pure refund calculation. The client never sends a refund amount; the server
// derives it from the amount paid and the notice given.
const { REFUND_POLICY } = require('../config/businessRules');
const { MS_PER_HOUR } = require('./dateTime');

// > 48h -> 100%, 24h..48h inclusive -> 50%, < 24h -> 0%
function refundPercentForNotice(hoursNotice) {
  if (hoursNotice > REFUND_POLICY.fullRefundAboveHours) return REFUND_POLICY.fullRefundPercent;
  if (hoursNotice >= REFUND_POLICY.partialRefundFromHours) return REFUND_POLICY.partialRefundPercent;
  return REFUND_POLICY.noRefundPercent;
}

function calculateRefund({ amountPaid, appointmentTime, cancelledAt }) {
  const paid = Number(amountPaid);
  if (!Number.isFinite(paid) || paid < 0) {
    throw new TypeError('amountPaid must be a non-negative number');
  }
  if (!(appointmentTime instanceof Date) || !(cancelledAt instanceof Date)
    || Number.isNaN(appointmentTime.getTime()) || Number.isNaN(cancelledAt.getTime())) {
    throw new TypeError('appointmentTime and cancelledAt must be valid Dates');
  }

  const hoursNotice = (appointmentTime.getTime() - cancelledAt.getTime()) / MS_PER_HOUR;
  const refundPercent = refundPercentForNotice(hoursNotice);

  // Work in whole cents so 50% of 150.00 is exactly 75.00 (no float drift).
  const paidCents = Math.round(paid * 100);
  const refundCents = Math.round((paidCents * refundPercent) / 100);

  return {
    hoursNotice: Math.round(hoursNotice * 100) / 100,
    refundPercent,
    refundAmount: refundCents / 100,
  };
}

module.exports = { calculateRefund, refundPercentForNotice };
