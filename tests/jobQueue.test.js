// parseJob is pure; requiring jobQueue does not open a Redis connection.
const { parseJob } = require('../src/queues/jobQueue');

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
