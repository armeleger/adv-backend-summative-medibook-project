const { pool } = require('./db');
const { APPOINTMENT_STATUS } = require('../config/businessRules');

const { BOOKED, CANCELLED } = APPOINTMENT_STATUS;

const SELECT_DETAILED = `
  SELECT a.appointment_id AS id,
         a.patient_id     AS patientId,
         p.full_name      AS patientName,
         p.email          AS patientEmail,
         p.phone          AS patientPhone,
         a.doctor_id      AS doctorId,
         d.full_name      AS doctorName,
         d.specialty,
         d.room,
         a.appt_datetime  AS appointmentDatetime,
         a.amount_paid    AS amountPaid,
         a.status,
         a.booked_at      AS bookedAt,
         a.cancelled_at   AS cancelledAt,
         a.refund_percent AS refundPercent,
         a.refund_amount  AS refundAmount
  FROM appointments a
  JOIN patients p ON p.patient_id = a.patient_id
  JOIN doctors  d ON d.doctor_id  = a.doctor_id`;

async function findById(id, db = pool) {
  const [rows] = await db.execute(`${SELECT_DETAILED} WHERE a.appointment_id = ?`, [id]);
  return rows[0] ?? null;
}

// Optional filters; each adds a fixed SQL fragment plus a ? parameter.
async function findAll({ patientId, doctorId, date, status } = {}) {
  const conditions = [];
  const params = [];
  if (patientId) { conditions.push('a.patient_id = ?'); params.push(patientId); }
  if (doctorId) { conditions.push('a.doctor_id = ?'); params.push(doctorId); }
  if (date) {
    conditions.push('a.appt_datetime >= ? AND a.appt_datetime < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(date, date);
  }
  if (status) { conditions.push('a.status = ?'); params.push(status); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(`${SELECT_DETAILED} ${where} ORDER BY a.appt_datetime, a.appointment_id`, params);
  return rows;
}

// Locks the appointment row so two cancellations cannot both succeed.
async function findByIdForUpdate(id, connection) {
  const [rows] = await connection.execute(
    `SELECT appointment_id AS id, patient_id AS patientId, doctor_id AS doctorId,
            appt_datetime AS appointmentDatetime, amount_paid AS amountPaid, status
     FROM appointments WHERE appointment_id = ? FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

async function isSlotTaken(doctorId, datetime, db = pool) {
  const [rows] = await db.execute(
    'SELECT 1 FROM appointments WHERE doctor_id = ? AND appt_datetime = ? AND status = ? LIMIT 1',
    [doctorId, datetime, BOOKED],
  );
  return rows.length > 0;
}

async function countBookedForDoctorOnDay(doctorId, day, db = pool) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total FROM appointments
     WHERE doctor_id = ? AND status = ?
       AND appt_datetime >= ? AND appt_datetime < DATE_ADD(?, INTERVAL 1 DAY)`,
    [doctorId, BOOKED, day, day],
  );
  return rows[0].total;
}

async function patientHasAppointmentAt(patientId, datetime, db = pool) {
  const [rows] = await db.execute(
    'SELECT 1 FROM appointments WHERE patient_id = ? AND appt_datetime = ? AND status = ? LIMIT 1',
    [patientId, datetime, BOOKED],
  );
  return rows.length > 0;
}

async function patientHasAppointmentWithDoctorOnDay(patientId, doctorId, day, db = pool) {
  const [rows] = await db.execute(
    `SELECT 1 FROM appointments
     WHERE patient_id = ? AND doctor_id = ? AND status = ?
       AND appt_datetime >= ? AND appt_datetime < DATE_ADD(?, INTERVAL 1 DAY)
     LIMIT 1`,
    [patientId, doctorId, BOOKED, day, day],
  );
  return rows.length > 0;
}

// Booked start times ("HH:mm") for one doctor on one day.
async function findBookedTimesForDoctorOnDay(doctorId, day) {
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(appt_datetime, '%H:%i') AS time FROM appointments
     WHERE doctor_id = ? AND status = ?
       AND appt_datetime >= ? AND appt_datetime < DATE_ADD(?, INTERVAL 1 DAY)
     ORDER BY appt_datetime`,
    [doctorId, BOOKED, day, day],
  );
  return rows.map((row) => row.time);
}

async function create({ patientId, doctorId, datetime, amountPaid }, connection) {
  const [result] = await connection.execute(
    'INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid) VALUES (?, ?, ?, ?)',
    [patientId, doctorId, datetime, amountPaid],
  );
  return result.insertId;
}

// Status, timestamp and refund are written by ONE statement, so the
// cancellation and its refund record cannot be saved separately.
async function markCancelled(id, { cancelledAt, refundPercent, refundAmount }, connection) {
  const [result] = await connection.execute(
    `UPDATE appointments
     SET status = ?, cancelled_at = ?, refund_percent = ?, refund_amount = ?
     WHERE appointment_id = ? AND status = ?`,
    [CANCELLED, cancelledAt, refundPercent, refundAmount, id, BOOKED],
  );
  return result.affectedRows === 1;
}

module.exports = {
  findById,
  findAll,
  findByIdForUpdate,
  isSlotTaken,
  countBookedForDoctorOnDay,
  patientHasAppointmentAt,
  patientHasAppointmentWithDoctorOnDay,
  findBookedTimesForDoctorOnDay,
  create,
  markCancelled,
};
