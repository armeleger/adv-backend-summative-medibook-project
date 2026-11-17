// Append-only audit log: one JSON object per line in logs/audit.log.
// Uses async fs only. log() never rejects - a logging failure is reported to
// the console but must never fail the booking/cancellation that triggered it.
const fs = require('node:fs/promises');
const path = require('node:path');
const env = require('../config/env');

function createAuditLogger(filePath) {
  let directoryReady = null;

  // mkdir runs once per process (the promise is cached); if it fails it is
  // retried on the next write.
  function ensureDirectory() {
    if (!directoryReady) {
      directoryReady = fs.mkdir(path.dirname(filePath), { recursive: true }).catch((err) => {
        directoryReady = null;
        throw err;
      });
    }
    return directoryReady;
  }

  async function log(event, details = {}) {
    const line = `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...details })}\n`;
    try {
      await ensureDirectory();
      await fs.appendFile(filePath, line, 'utf8');
      return true;
    } catch (err) {
      console.error(`[audit] could not write ${event} to ${filePath}: ${err.message}`);
      return false;
    }
  }

  // Called at startup so logs/ exists from the first run.
  async function init() {
    try {
      await ensureDirectory();
    } catch (err) {
      console.error(`[audit] could not create log directory: ${err.message}`);
    }
  }

  return { log, init, filePath };
}

module.exports = createAuditLogger(env.auditLogFile);
module.exports.createAuditLogger = createAuditLogger;
