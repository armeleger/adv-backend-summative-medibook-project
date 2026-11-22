// HTTP-level tests: real Express app, routes, controllers, validation and the
// central error handler, with every model and service mocked. No MySQL or
// Redis is needed.
const request = require('supertest');

jest.mock('../src/models/patientModel');
jest.mock('../src/models/doctorModel');
jest.mock('../src/models/appointmentModel');
jest.mock('../src/models/reportModel');
jest.mock('../src/services/bookingService');
jest.mock('../src/services/cancellationService');
jest.mock('../src/services/waitlistService');

const app = require('../src/app');
const patientModel = require('../src/models/patientModel');
const { bookAppointment } = require('../src/services/bookingService');
const { cancelAppointment } = require('../src/services/cancellationService');
const waitlistService = require('../src/services/waitlistService');
const AppError = require('../src/utils/AppError');

const PATIENT = { id: 1, fullName: 'Ama Mensah', email: 'ama@mail.com', phone: '0244-111-222' };

afterEach(() => {
  jest.resetAllMocks();
});

describe('general', () => {
  test('GET /health -> 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('unknown route -> 404 in the standard error format', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  test('malformed JSON -> 400', async () => {
    const res = await request(app).post('/api/patients').set('Content-Type', 'application/json').send('{"fullName":');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Request body is not valid JSON');
  });

  test('an unexpected error -> 500 without leaking internals', async () => {
    patientModel.findAll.mockRejectedValue(new Error('secret stack detail'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/patients');
    errorSpy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  });
});

describe('patients CRUD', () => {
  test('GET /api/patients/:id with a non-numeric id -> 400', async () => {
    const res = await request(app).get('/api/patients/abc');
    expect(res.status).toBe(400);
    expect(patientModel.findById).not.toHaveBeenCalled();
  });

  test('GET /api/patients/:id for an unknown id -> 404', async () => {
    patientModel.findById.mockResolvedValue(null);
    const res = await request(app).get('/api/patients/999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Patient 999 not found');
  });

  test('POST /api/patients with invalid data -> 400 listing every problem', async () => {
    const res = await request(app).post('/api/patients').send({ fullName: 'A', email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      'fullName must be between 2 and 100 characters',
      'email must be a valid email address',
      'phone is required',
    ]);
    expect(patientModel.create).not.toHaveBeenCalled();
  });

  test('POST /api/patients -> 201 with a Location header', async () => {
    patientModel.create.mockResolvedValue(1);
    patientModel.findById.mockResolvedValue(PATIENT);
    const res = await request(app).post('/api/patients')
      .send({ fullName: 'Ama Mensah', email: 'AMA@mail.com', phone: '0244-111-222' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/patients/1');
    expect(patientModel.create).toHaveBeenCalledWith({ fullName: 'Ama Mensah', email: 'ama@mail.com', phone: '0244-111-222' });
  });

  test('duplicate email from MySQL -> 409 with a clear message', async () => {
    const duplicate = Object.assign(new Error('Duplicate'), {
      code: 'ER_DUP_ENTRY',
      sqlMessage: "Duplicate entry 'ama@mail.com' for key 'patients.uq_patients_email'",
    });
    patientModel.create.mockRejectedValue(duplicate);
    const res = await request(app).post('/api/patients')
      .send({ fullName: 'Ama Mensah', email: 'ama@mail.com', phone: '0244-111-222' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('A patient with this email already exists');
  });

  test('DELETE a patient with appointment history -> 409', async () => {
    patientModel.findById.mockResolvedValue(PATIENT);
    patientModel.countAppointments.mockResolvedValue(3);
    const res = await request(app).delete('/api/patients/1');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_APPOINTMENTS');
    expect(patientModel.remove).not.toHaveBeenCalled();
  });

  test('DELETE a patient without history -> 204', async () => {
    patientModel.findById.mockResolvedValue(PATIENT);
    patientModel.countAppointments.mockResolvedValue(0);
    patientModel.remove.mockResolvedValue(true);
    const res = await request(app).delete('/api/patients/1');
    expect(res.status).toBe(204);
  });
});

describe('appointments', () => {
  const booking = { patientId: 1, doctorId: 1, appointmentDatetime: '2026-12-01T10:00' };

  test('POST /api/appointments with bad ids -> 400 before reaching the service', async () => {
    const res = await request(app).post('/api/appointments').send({ ...booking, patientId: 'x' });
    expect(res.status).toBe(400);
    expect(bookAppointment).not.toHaveBeenCalled();
  });

  test('a booking rule violation from the service -> 422', async () => {
    bookAppointment.mockRejectedValue(AppError.unprocessable('Appointments can only be booked in the future', 'SLOT_IN_PAST'));
    const res = await request(app).post('/api/appointments').send(booking);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SLOT_IN_PAST');
  });

  test('a full day -> 409 with the waitlist offer in details', async () => {
    bookAppointment.mockRejectedValue(AppError.conflict('Day full', 'DAY_FULL', { waitlist: { offered: true, path: '/api/waitlist' } }));
    const res = await request(app).post('/api/appointments').send(booking);
    expect(res.status).toBe(409);
    expect(res.body.error.details.waitlist).toEqual({ offered: true, path: '/api/waitlist' });
  });

  test('a successful booking -> 201 with Location', async () => {
    bookAppointment.mockResolvedValue({ id: 42, ...booking, status: 'BOOKED' });
    const res = await request(app).post('/api/appointments').send(booking);
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/appointments/42');
  });

  test('DELETE /api/appointments/:id -> 200 with the refund stated', async () => {
    cancelAppointment.mockResolvedValue({
      appointment: { id: 5, status: 'CANCELLED' },
      refund: { hoursNotice: 30, refundPercent: 50, refundAmount: 75 },
    });
    const res = await request(app).delete('/api/appointments/5');
    expect(res.status).toBe(200);
    expect(res.body.refund).toMatchObject({ refundPercent: 50, refundAmount: 75 });
    expect(res.body.refund.message).toContain('refund of 75.00 (50%)');
  });

  test('GET /api/appointments with an invalid status filter -> 400', async () => {
    const res = await request(app).get('/api/appointments?status=DONE');
    expect(res.status).toBe(400);
  });
});

describe('waitlist', () => {
  test('DELETE /api/waitlist/:doctorId/:date/:patientId -> 204', async () => {
    waitlistService.leaveWaitlist.mockResolvedValue();
    const res = await request(app).delete('/api/waitlist/1/2026-12-01/3');
    expect(res.status).toBe(204);
    expect(waitlistService.leaveWaitlist).toHaveBeenCalledWith({ doctorId: 1, day: '2026-12-01', patientId: 3 });
  });

  test('leaving with an invalid date -> 400', async () => {
    const res = await request(app).delete('/api/waitlist/1/2026-02-30/3');
    expect(res.status).toBe(400);
    expect(waitlistService.leaveWaitlist).not.toHaveBeenCalled();
  });

  test('leaving when not on the waitlist -> 404', async () => {
    waitlistService.leaveWaitlist.mockRejectedValue(AppError.notFound('Not on waitlist', 'NOT_ON_WAITLIST'));
    const res = await request(app).delete('/api/waitlist/1/2026-12-01/3');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_ON_WAITLIST');
  });
});

describe('feedback page', () => {
  test('GET /feedback?lang=fr serves the French page', async () => {
    const res = await request(app).get('/feedback?lang=fr');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<html lang="fr">');
  });

  test('an unsupported language falls back to English', async () => {
    const res = await request(app).get('/feedback?lang=xx');
    expect(res.text).toContain('<html lang="en">');
  });
});
