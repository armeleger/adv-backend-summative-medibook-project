const { calculateRefund, refundPercentForNotice } = require('../src/utils/refundCalculator');

const HOUR = 60 * 60 * 1000;
// Fixed appointment time - tests never depend on "now".
const APPOINTMENT = new Date(2026, 7, 10, 9, 0); // 10 Aug 2026, 09:00
const cancelledHoursBefore = (hours) => new Date(APPOINTMENT.getTime() - hours * HOUR);

describe('calculateRefund - tiers', () => {
  test('more than 48 hours notice refunds 100%', () => {
    const result = calculateRefund({ amountPaid: 150, appointmentTime: APPOINTMENT, cancelledAt: cancelledHoursBefore(72) });
    expect(result).toEqual({ hoursNotice: 72, refundPercent: 100, refundAmount: 150 });
  });

  test('between 24 and 48 hours notice refunds 50%', () => {
    const result = calculateRefund({ amountPaid: 150, appointmentTime: APPOINTMENT, cancelledAt: cancelledHoursBefore(36) });
    expect(result).toEqual({ hoursNotice: 36, refundPercent: 50, refundAmount: 75 });
  });

  test('less than 24 hours notice refunds nothing', () => {
    const result = calculateRefund({ amountPaid: 150, appointmentTime: APPOINTMENT, cancelledAt: cancelledHoursBefore(5) });
    expect(result).toEqual({ hoursNotice: 5, refundPercent: 0, refundAmount: 0 });
  });
});

describe('calculateRefund - boundaries (documented policy: both are 50%)', () => {
  test('exactly 48 hours is NOT "more than 48" -> 50%', () => {
    const result = calculateRefund({ amountPaid: 100, appointmentTime: APPOINTMENT, cancelledAt: cancelledHoursBefore(48) });
    expect(result.refundPercent).toBe(50);
    expect(result.refundAmount).toBe(50);
  });

  test('one second over 48 hours -> 100%', () => {
    const cancelledAt = new Date(APPOINTMENT.getTime() - 48 * HOUR - 1000);
    expect(calculateRefund({ amountPaid: 100, appointmentTime: APPOINTMENT, cancelledAt }).refundPercent).toBe(100);
  });

  test('exactly 24 hours is inside the 24-48h tier -> 50%', () => {
    const result = calculateRefund({ amountPaid: 100, appointmentTime: APPOINTMENT, cancelledAt: cancelledHoursBefore(24) });
    expect(result.refundPercent).toBe(50);
    expect(result.refundAmount).toBe(50);
  });

  test('one second under 24 hours -> 0%', () => {
    const cancelledAt = new Date(APPOINTMENT.getTime() - 24 * HOUR + 1000);
    expect(calculateRefund({ amountPaid: 100, appointmentTime: APPOINTMENT, cancelledAt }).refundPercent).toBe(0);
  });
});

describe('calculateRefund - money and input handling', () => {
  test('rounds to whole cents without floating-point drift', () => {
    const result = calculateRefund({ amountPaid: 120.15, appointmentTime: APPOINTMENT, cancelledAt: cancelledHoursBefore(30) });
    expect(result.refundAmount).toBe(60.08); // 50% of 12015 cents = 6007.5 -> 6008
  });

  test('accepts DECIMAL values that arrive as strings', () => {
    const result = calculateRefund({ amountPaid: '80.00', appointmentTime: APPOINTMENT, cancelledAt: cancelledHoursBefore(100) });
    expect(result.refundAmount).toBe(80);
  });

  test('rejects an invalid amount or date', () => {
    expect(() => calculateRefund({ amountPaid: -1, appointmentTime: APPOINTMENT, cancelledAt: new Date() })).toThrow(TypeError);
    expect(() => calculateRefund({ amountPaid: 10, appointmentTime: new Date('nope'), cancelledAt: new Date() })).toThrow(TypeError);
  });

  test('refundPercentForNotice maps hours straight to a tier', () => {
    expect([49, 48, 24, 23.99, 0].map(refundPercentForNotice)).toEqual([100, 50, 50, 0, 0]);
  });
});
