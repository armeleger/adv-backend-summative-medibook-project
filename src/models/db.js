// MySQL connection pool and transaction helper.
const mysql = require('mysql2/promise');
const env = require('../config/env');

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATETIME columns as "YYYY-MM-DD HH:mm:ss" clinic wall-clock strings
  // instead of converting them to JS Dates through the server's timezone.
  dateStrings: true,
  // Return DECIMAL columns (money) as numbers rather than strings.
  decimalNumbers: true,
});

// Only these values may be interpolated into SET TRANSACTION.
const ISOLATION_LEVELS = new Set(['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']);

// Runs work(connection) inside a transaction: commit on success, roll back on
// any error. Every statement inside must use the connection it is given.
async function withTransaction(work, { isolationLevel } = {}) {
  if (isolationLevel && !ISOLATION_LEVELS.has(isolationLevel)) {
    throw new Error(`Unsupported isolation level: ${isolationLevel}`);
  }
  const connection = await pool.getConnection();
  try {
    if (isolationLevel) {
      await connection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    }
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }
}

async function ping() {
  await pool.query('SELECT 1');
}

async function close() {
  await pool.end();
}

module.exports = { pool, withTransaction, ping, close };
