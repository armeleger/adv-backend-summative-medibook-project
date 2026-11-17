const AppError = require('../utils/AppError');

// Any request that matched no route.
function notFound(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND'));
}

module.exports = notFound;
