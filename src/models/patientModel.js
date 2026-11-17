const { pool } = require('./db');
const { buildSetClause } = require('./sqlHelpers');

const SELECT_PATIENT = `
  SELECT patient_id AS id, full_name AS fullName, email, phone,
         created_at AS createdAt, updated_at AS updatedAt
  FROM patients`;

const COLUMNS = { fullName: 'full_name', email: 'email', phone: 'phone' };

async function findAll() {
  const [rows] = await pool.execute(`${SELECT_PATIENT} ORDER BY patient_id`);
  return rows;
}

// db may be a transaction connection so the read joins that transaction.
async function findById(id, db = pool) {
  const [rows] = await db.execute(`${SELECT_PATIENT} WHERE patient_id = ?`, [id]);
  return rows[0] ?? null;
}

async function create({ fullName, email, phone }) {
  const [result] = await pool.execute(
    'INSERT INTO patients (full_name, email, phone) VALUES (?, ?, ?)',
    [fullName, email, phone],
  );
  return result.insertId;
}

// Returns true when a row was found (even if no value changed).
async function update(id, fields) {
  const { clause, values } = buildSetClause(fields, COLUMNS);
  const [result] = await pool.execute(`UPDATE patients SET ${clause} WHERE patient_id = ?`, [...values, id]);
  return result.affectedRows > 0;
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM patients WHERE patient_id = ?', [id]);
  return result.affectedRows > 0;
}

async function countAppointments(id) {
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM appointments WHERE patient_id = ?', [id]);
  return rows[0].total;
}

module.exports = { findAll, findById, create, update, remove, countAppointments };
