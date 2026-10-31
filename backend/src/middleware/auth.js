const jwt = require('jsonwebtoken');
const { createError } = require('./errorHandler');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError(401, 'Authentication required'));
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, role, customerId? }
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(createError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) {
    return next(createError(403, 'Forbidden'));
  }
  next();
};

module.exports = { authenticate, authorize };
