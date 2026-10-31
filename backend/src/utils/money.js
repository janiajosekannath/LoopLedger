/**
 * round2 — round a number to 2 decimal places using banker-safe arithmetic.
 */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

module.exports = { round2 };
