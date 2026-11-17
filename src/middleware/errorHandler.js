// Central error handler: every error thrown in a route ends up here and is
// turned into a consistent { error: { message, code, details } } response.
const AppError = require('../utils/AppError');

// MySQL errors that can reach here, translated to client-facing responses.
const MYSQL_ERRORS = {
  ER_DUP_ENTRY: () => new AppError(409, 'A record with the same unique value already exists', { code: 'DUPLICATE' }),
  ER_ROW_IS_REFERENCED_2: () => new AppError(409, 'This record is referenced by appointments and cannot be deleted', { code: 'HAS_APPOINTMENTS' }),
  ER_CHECK_CONSTRAINT_VIOLATED: () => new AppError(422, 'The data violates a database rule', { code: 'CONSTRAINT_VIOLATION' }),
  ER_LOCK_DEADLOCK: () => new AppError(503, 'The system is busy, please retry', { code: 'RETRY' }),
  ER_LOCK_WAIT_TIMEOUT: () => new AppError(503, 'The system is busy, please retry', { code: 'RETRY' }),
  ECONNREFUSED: () => new AppError(503, 'The database is unavailable', { code: 'DATABASE_UNAVAILABLE' }),
};

// The duplicate-email case deserves a specific message.
const DUPLICATE_KEY_MESSAGES = {
  uq_patients_email: 'A patient with this email already exists',
};

function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err.type === 'entity.parse.failed') return AppError.badRequest('Request body is not valid JSON');
  if (err.type === 'entity.too.large') return new AppError(413, 'Request body is too large', { code: 'PAYLOAD_TOO_LARGE' });
  if (err.code === 'ER_DUP_ENTRY') {
    const key = Object.keys(DUPLICATE_KEY_MESSAGES).find((name) => err.sqlMessage?.includes(name));
    if (key) return AppError.conflict(DUPLICATE_KEY_MESSAGES[key], 'DUPLICATE');
  }
  return MYSQL_ERRORS[err.code]?.() ?? null;
}

// Express recognises error-handling middleware by its four parameters.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err); // let Express close the connection
  const appError = toAppError(err);
  if (!appError) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({ error: { message: 'Internal server error', code: 'INTERNAL_ERROR' } });
  }
  const { statusCode, message, code, details } = appError;
  return res.status(statusCode).json({ error: { message, code, ...(details && { details }) } });
}

module.exports = errorHandler;
