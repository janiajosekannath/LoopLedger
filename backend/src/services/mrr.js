/**
 * services/mrr.js
 * MRR (Monthly Recurring Revenue) normalization and change logging.
 *
 * Formulas:
 * Base recurring revenue = subtotal - discountTotal (before tax)
 * Normalization factor to monthly:
 * - daily: * 30
 * - weekly: * 52 / 12
 * - monthly: * 1
 * - yearly: / 12
 * ARR = MRR * 12
 */

const { round2 } = require('../utils/money');
const { MrrChange } = require('../models/History');

/**
 * Calculates normalized MRR for a subscription.
 *
 * @param {Object} subscription - Subscription document or object with { subtotal, discountTotal, plan: { billingPeriod } }
 * @param {string} [billingPeriod] - Optional period override ('daily'|'weekly'|'monthly'|'yearly')
 * @returns {number} Normalized monthly recurring revenue rounded to 2 decimals
 */
function calculateMrr(subscription, billingPeriod) {
  const period =
    billingPeriod ||
    (subscription.plan && subscription.plan.billingPeriod) ||
    subscription.billingPeriod ||
    'monthly';

  const baseRevenue = Math.max(
    0,
    (Number(subscription.subtotal) || 0) - (Number(subscription.discountTotal) || 0)
  );

  let mrr = 0;
  switch (period.toLowerCase()) {
    case 'daily':
      mrr = baseRevenue * 30;
      break;
    case 'weekly':
      mrr = (baseRevenue * 52) / 12;
      break;
    case 'monthly':
      mrr = baseRevenue;
      break;
    case 'yearly':
      mrr = baseRevenue / 12;
      break;
    default:
      mrr = baseRevenue;
  }

  return round2(mrr);
}

/**
 * Records an MRR transition in the MrrChange collection.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.subscriptionId
 * @param {'new' | 'expansion' | 'contraction' | 'churn'} params.type
 * @param {number} params.amount - The MRR delta or value
 * @param {Date} [params.at] - Timestamp (defaults to now)
 * @returns {Promise<Object>} Created MrrChange record
 */
async function recordMrrChange({ subscriptionId, type, amount, at = new Date() }) {
  if (!subscriptionId || !type || amount == null) {
    throw new Error('subscriptionId, type, and amount are required to record MrrChange');
  }

  return MrrChange.create({
    subscription: subscriptionId,
    type,
    amount: round2(amount),
    at,
  });
}

module.exports = {
  calculateMrr,
  recordMrrChange,
};
