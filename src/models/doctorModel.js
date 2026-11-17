const { pool } = require('./db');
const { buildSetClause } = require('./sqlHelpers');

const SELECT_DOCTOR = `
  SELECT doctor_id AS id, full_name AS fullName, specialty,
         consultation_fee AS consultationFee, room,
         created_at AS createdAt, updated_at AS updatedAt
  FROM doctors`;

const COLUMNS = {
  fullName: 'full_name',
  specialty: 'specialty',
  consultationFee: 'consultation_fee',
  room: 'room',
};

async function findAll() {
  const [rows] = await pool.execute(`${SELECT_DOCTOR} ORDER BY doctor_id`);
  return rows;
}

async function findById(id, db = pool) {
  const [rows] = await db.execute(`${SELECT_DOCTOR} WHERE doctor_id = ?`, [id]);
  return rows[0] ?? null;
}

// Locks the doctor row until the surrounding transaction ends. Every booking
// for this doctor takes the same lock first, so bookings for one doctor run
// one at a time: the daily-cap count cannot race. Bookings for different
// doctors lock different rows and still run in parallel.
async function findByIdForUpdate(id, connection) {
  const [rows] = await connection.execute(`${SELECT_DOCTOR} WHERE doctor_id = ? FOR UPDATE`, [id]);
  return rows[0] ?? null;
}

async function create({ fullName, specialty, consultationFee, room }) {
  const [result] = await pool.execute(
    'INSERT INTO doctors (full_name, specialty, consultation_fee, room) VALUES (?, ?, ?, ?)',
    [fullName, specialty, consultationFee, room],
  );
  return result.insertId;
}

async function update(id, fields) {
  const { clause, values } = buildSetClause(fields, COLUMNS);
  const [result] = await pool.execute(`UPDATE doctors SET ${clause} WHERE doctor_id = ?`, [...values, id]);
  return result.affectedRows > 0;
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM doctors WHERE doctor_id = ?', [id]);
  return result.affectedRows > 0;
}

async function countAppointments(id) {
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM appointments WHERE doctor_id = ?', [id]);
  return rows[0].total;
}

module.exports = { findAll, findById, findByIdForUpdate, create, update, remove, countAppointments };
