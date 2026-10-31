// services/billingPeriods.js
// Utility to calculate billing periods for a subscription up to a given `asOf` date.
// It respects the subscription plan's billingPeriod (daily, weekly, monthly, yearly)
// and generates sequential periods when the system was offline (catch‑up).

const moment = require('moment'); // moment is already a dependency of the project (used elsewhere)

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
  const { billingPeriod, availableFrom, availableTo, autoClose, allowPause, allowRenew, active } = subscription.plan;
  if (!active) return [];

  const periods = [];
  let next = subscription.nextBillingDate ? moment(subscription.nextBillingDate) : null;
  // If nextBillingDate is missing, start from subscription startDate
  if (!next) next = moment(subscription.startDate);

  const limit = moment(asOf);
  // Guard: do not go beyond subscription.expiryDate
  const expiry = subscription.expiryDate ? moment(subscription.expiryDate) : null;

  while (next.isSameOrBefore(limit)) {
    if (expiry && next.isAfter(expiry)) break;
    const start = next.clone();
    // Compute end based on billingPeriod
    let end;
    switch (billingPeriod) {
      case 'daily':
        end = start.clone().add(1, 'day');
        break;
      case 'weekly':
        end = start.clone().add(1, 'week');
        break;
      case 'monthly':
        end = start.clone().add(1, 'month');
        break;
      case 'yearly':
        end = start.clone().add(1, 'year');
        break;
      default:
        end = start.clone().add(1, 'month');
    }
    periods.push({ periodStart: start.toDate(), periodEnd: end.toDate() });
    // Advance to next period start
    next = end.clone();
  }
  return periods;
}

module.exports = { getDuePeriods };
