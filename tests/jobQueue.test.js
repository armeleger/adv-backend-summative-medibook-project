// parseJob is pure; requiring jobQueue does not open a Redis connection.
const { parseJob, retryDelayMs, MAX_ATTEMPTS } = require('../src/queues/jobQueue');

describe('parseJob', () => {
  test('parses a valid job and defaults attempts to 0', () => {
    const job = parseJob(JSON.stringify({ id: 'a', type: 'SLOT_FREED', payload: { doctorId: 1 } }));
    expect(job).toEqual({ id: 'a', type: 'SLOT_FREED', payload: { doctorId: 1 }, attempts: 0 });
  });

  test('keeps an existing attempts count', () => {
    expect(parseJob(JSON.stringify({ type: 'X', payload: {}, attempts: 3 })).attempts).toBe(3);
  });

  test.each([
    ['not JSON', 'not-json'],
    ['JSON null', 'null'],
    ['a number', '42'],
    ['missing type', JSON.stringify({ payload: {} })],
    ['missing payload', JSON.stringify({ type: 'SLOT_FREED' })],
    ['payload not an object', JSON.stringify({ type: 'SLOT_FREED', payload: 'x' })],
  ])('rejects %s', (_label, raw) => {
    expect(parseJob(raw)).toBeNull();
  });
});

describe('retryDelayMs', () => {
  test('doubles from 5 seconds and is capped at 60 seconds', () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelayMs)).toEqual([5000, 10000, 20000, 40000, 60000, 60000]);
  });

  test('all retries together cover a short outage (over 2 minutes)', () => {
    let total = 0;
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) total += retryDelayMs(attempt);
    expect(total).toBeGreaterThanOrEqual(120000);
  });
});
