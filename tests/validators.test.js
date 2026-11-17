const { validatePatient, validateDoctor, validateBooking, parsePositiveInt } = require('../src/utils/validators');

describe('validatePatient', () => {
  test('cleans a valid payload (trims, lower-cases email)', () => {
    const { errors, value } = validatePatient({ fullName: '  Ama Mensah ', email: 'AMA@Mail.com', phone: '0244-111-222' });
    expect(errors).toEqual([]);
    expect(value).toEqual({ fullName: 'Ama Mensah', email: 'ama@mail.com', phone: '0244-111-222' });
  });

  test('reports every missing field on create', () => {
    const { errors } = validatePatient({});
    expect(errors).toEqual(['fullName is required', 'email is required', 'phone is required']);
  });

  test('rejects unknown fields and bad formats', () => {
    const { errors } = validatePatient({ fullName: 'A', email: 'not-an-email', phone: 'abc', role: 'admin' });
    expect(errors).toHaveLength(4);
    expect(errors[0]).toBe('Unknown field(s): role');
  });

  test('partial update needs at least one field', () => {
    expect(validatePatient({}, { partial: true }).errors).toEqual(['Provide at least one of: fullName, email, phone']);
    expect(validatePatient({ phone: '+233 24 111 2222' }, { partial: true }).errors).toEqual([]);
  });

  test('rejects a non-object body', () => {
    expect(validatePatient([1, 2]).errors).toEqual(['Request body must be a JSON object']);
  });
});

describe('validateDoctor', () => {
  test('consultationFee must be a non-negative number with at most 2 decimals', () => {
    const base = { fullName: 'Dr. Adjei', specialty: 'Paediatrics', room: 'R-03' };
    expect(validateDoctor({ ...base, consultationFee: 100.5 }).errors).toEqual([]);
    expect(validateDoctor({ ...base, consultationFee: '100' }).errors).toEqual(['consultationFee must be a number']);
    expect(validateDoctor({ ...base, consultationFee: -5 }).errors[0]).toMatch(/between 0/);
    expect(validateDoctor({ ...base, consultationFee: 10.555 }).errors).toEqual(['consultationFee can have at most 2 decimal places']);
  });
});

describe('validateBooking', () => {
  test('ids must be positive integers', () => {
    const { errors } = validateBooking({ patientId: '1', doctorId: 0, appointmentDatetime: '2026-08-10T09:00' });
    expect(errors).toEqual(['patientId must be a positive integer', 'doctorId must be a positive integer']);
  });
});

describe('parsePositiveInt', () => {
  test.each([
    ['42', 42],
    ['0', null],
    ['-3', null],
    ['1.5', null],
    ['4x', null],
    ['99999999999', null],
    [7, 7],
  ])('%p -> %p', (input, expected) => {
    expect(parsePositiveInt(input)).toBe(expected);
  });
});
