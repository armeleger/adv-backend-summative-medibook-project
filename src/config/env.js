// All runtime configuration comes from environment variables (see .env.example).
const path = require('node:path');
require('dotenv').config({ quiet: true });

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function toPort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  port: toPort(process.env.PORT, 3000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toPort(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medibook',
  },
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  auditLogFile: path.resolve(PROJECT_ROOT, process.env.AUDIT_LOG_FILE || path.join('logs', 'audit.log')),
};
