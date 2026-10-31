/**
 * asyncHandler — wraps an async Express route handler and passes errors
 * to next() so the central error handler can catch them.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
