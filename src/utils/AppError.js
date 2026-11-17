// An error that maps directly onto an HTTP response. `code` is a stable,
// machine-readable identifier (e.g. DAY_FULL) that clients and the worker can
// branch on; `details` carries extra context such as validation messages.
class AppError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, message, { code: 'VALIDATION_ERROR', details });
  }

  static notFound(message, code = 'NOT_FOUND') {
    return new AppError(404, message, { code });
  }

  static conflict(message, code, details) {
    return new AppError(409, message, { code, details });
  }

  static unprocessable(message, code, details) {
    return new AppError(422, message, { code, details });
  }

  static serviceUnavailable(message, code = 'SERVICE_UNAVAILABLE') {
    return new AppError(503, message, { code });
  }
}

module.exports = AppError;
