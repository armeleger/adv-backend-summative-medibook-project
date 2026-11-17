const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createAuditLogger } = require('../src/utils/auditLogger');

describe('auditLogger', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medibook-audit-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('creates the log directory on first write and appends JSON lines', async () => {
    const file = path.join(tempDir, 'nested', 'logs', 'audit.log');
    const logger = createAuditLogger(file);

    await logger.log('APPOINTMENT_BOOKED', { appointmentId: 1 });
    await logger.log('APPOINTMENT_CANCELLED', { appointmentId: 1, refundAmount: 75 });

    const lines = (await fs.readFile(file, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ event: 'APPOINTMENT_BOOKED', appointmentId: 1 });
    expect(lines[1]).toMatchObject({ event: 'APPOINTMENT_CANCELLED', refundAmount: 75 });
    expect(Number.isNaN(Date.parse(lines[0].timestamp))).toBe(false);
  });

  test('a write failure resolves to false instead of throwing', async () => {
    // The "file" is actually a directory, so appendFile fails.
    const logger = createAuditLogger(tempDir);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(logger.log('APPOINTMENT_BOOKED', {})).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
