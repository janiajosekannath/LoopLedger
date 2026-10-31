/**
 * jobs/autoClose.js
 * Daily automated cron job to close active subscriptions that have passed their expiryDate,
 * provided the subscription plan has autoClose enabled.
 */

const Subscription = require('../models/Subscription');
const { recordStatusChange } = require('../services/audit');
const { calculateMrr, recordMrrChange } = require('../services/mrr');

/**
 * Runs the auto-close process for expired subscriptions.
 * Can be called by node-cron or manually in test suites.
 *
 * @param {Date} [asOf=new Date()]
 * @returns {Promise<{ checked: number, closed: number, details: Array }>}
 */
async function autoCloseSubscriptions(asOf = new Date()) {
  const now = asOf instanceof Date ? asOf : new Date(asOf);

  // Find all active subscriptions where expiryDate has passed
  const expiredActiveSubs = await Subscription.find({
    status: 'active',
    expiryDate: { $lte: now },
  }).populate('plan');

  let closedCount = 0;
  const details = [];

  for (const sub of expiredActiveSubs) {
    if (sub.plan && sub.plan.autoClose) {
      const prevStatus = sub.status;
      sub.status = 'closed';
      sub.closedAt = now;
      await sub.save();

      // Record audit history
      await recordStatusChange({
        entityType: 'subscription',
        entityId: sub._id,
        from: prevStatus,
        to: 'closed',
        note: 'Auto-closed by scheduled cron: plan autoClose policy is enabled',
        at: now,
      });

      // Record churn in MrrChange
      const mrr = calculateMrr(sub);
      await recordMrrChange({
        subscriptionId: sub._id,
        type: 'churn',
        amount: mrr,
        at: now,
      });

      closedCount++;
      details.push({
        subscriptionId: sub._id,
        number: sub.number,
        plan: sub.plan.name,
        expiryDate: sub.expiryDate,
        mrr,
      });
    }
  }

  return {
    checked: expiredActiveSubs.length,
    closed: closedCount,
    details,
  };
}

module.exports = {
  autoCloseSubscriptions,
};
