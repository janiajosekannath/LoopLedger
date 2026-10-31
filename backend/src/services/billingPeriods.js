// services/billingPeriods.js
// Utility to calculate billing periods for a subscription up to a given `asOf` date.
// It respects the subscription plan's billingPeriod (daily, weekly, monthly, yearly)
// and generates sequential periods when the system was offline (catch-up).

function addPeriod(date, billingPeriod) {
  const d = new Date(date);
  switch (billingPeriod) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}

/**
 * Returns an array of period objects for the given subscription.
 * Each period contains `periodStart` and `periodEnd` Date objects.
 *
 * @param {Object} subscription Mongoose subscription document (populated `plan`).
 * @param {Date} asOf          Date up to which periods should be generated (inclusive).
 * @returns {Array<{periodStart: Date, periodEnd: Date}>}
 */
function getDuePeriods(subscription, asOf) {
  if (!subscription || !subscription.plan) return [];
  const plan = subscription.plan;
  if (plan.active === false) return [];

  const billingPeriod = plan.billingPeriod || 'monthly';
  const periods = [];

  let next = subscription.nextBillingDate
    ? new Date(subscription.nextBillingDate)
    : new Date(subscription.startDate || Date.now());

  const limit = new Date(asOf || Date.now());
  const expiry = subscription.expiryDate ? new Date(subscription.expiryDate) : null;

  while (next <= limit) {
    if (expiry && next > expiry) break;

    const start = new Date(next);
    const end = addPeriod(start, billingPeriod);

    periods.push({ periodStart: start, periodEnd: end });
    next = new Date(end);
  }

  return periods;
}

module.exports = { getDuePeriods };
