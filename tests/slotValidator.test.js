const { validateSlot, listDailySlotTimes } = require('../src/utils/slotValidator');

// Fixed "now" so results never depend on when the tests run.
const NOW = new Date(2026, 7, 1, 12, 0); // 1 Aug 2026, 12:00

describe('validateSlot', () => {
  test('accepts a future slot on a 30-minute boundary inside working hours', () => {
    const result = validateSlot('2026-08-10T09:30', NOW);
    expect(result.ok).toBe(true);
    expect(result.slot.datetime).toBe('2026-08-10 09:30:00');
    expect(result.slot.day).toBe('2026-08-10');
  });

  test('accepts the MySQL "YYYY-MM-DD HH:mm:ss" form as well', () => {
    expect(validateSlot('2026-08-10 14:00:00', NOW).ok).toBe(true);
  });

  test('09:00 (first slot) and 16:30 (last slot) are both allowed', () => {
    expect(validateSlot('2026-08-10T09:00', NOW).ok).toBe(true);
    expect(validateSlot('2026-08-10T16:30', NOW).ok).toBe(true);
  });

  test('17:00 exactly is rejected - the appointment would end after closing', () => {
    expect(validateSlot('2026-08-10T17:00', NOW)).toMatchObject({ ok: false, status: 422, code: 'OUTSIDE_WORKING_HOURS' });
  });

  test('08:30 (before opening) is rejected', () => {
    expect(validateSlot('2026-08-10T08:30', NOW)).toMatchObject({ ok: false, status: 422, code: 'OUTSIDE_WORKING_HOURS' });
  });

  test('09:15 is not on a 30-minute boundary', () => {
    expect(validateSlot('2026-08-10T09:15', NOW)).toMatchObject({ ok: false, status: 422, code: 'NOT_ON_SLOT_BOUNDARY' });
  });

  test('a non-zero seconds value is not on a boundary', () => {
    expect(validateSlot('2026-08-10 09:30:15', NOW)).toMatchObject({ ok: false, code: 'NOT_ON_SLOT_BOUNDARY' });
  });

  test('a slot in the past is rejected', () => {
    expect(validateSlot('2026-07-31T10:00', NOW)).toMatchObject({ ok: false, status: 422, code: 'SLOT_IN_PAST' });
  });

  test('"now" itself is not the future', () => {
    expect(validateSlot('2026-08-01T12:00', NOW)).toMatchObject({ ok: false, code: 'SLOT_IN_PAST' });
  });

  test.each([
    ['impossible date', '2026-02-30T10:00'],
    ['impossible hour', '2026-08-10T25:00'],
    ['wrong format', '10/08/2026 10:00'],
    ['date only', '2026-08-10'],
    ['empty string', ''],
    ['not a string', 1754812800000],
    ['missing', undefined],
  ])('malformed input (%s) is a 400', (_label, input) => {
    expect(validateSlot(input, NOW)).toMatchObject({ ok: false, status: 400, code: 'INVALID_DATETIME' });
  });
});

describe('listDailySlotTimes', () => {
  test('lists every slot start from 09:00 to 16:30', () => {
    const slots = listDailySlotTimes();
    expect(slots[0]).toBe('09:00');
    expect(slots.at(-1)).toBe('16:30');
    expect(slots).toHaveLength(16);
  });
});
