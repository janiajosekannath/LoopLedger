/**
 * services/reportsService.js
 * Phase 7 – Revenue analytics, MRR/ARR waterfall, churn, LTV, ARPU
 *
 * IMPORTANT: All period keys and date math use UTC to stay consistent
 * with MongoDB $year / $month aggregation operators.
 */

const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const { MrrChange } = require('../models/History');
const { round2 } = require('../utils/money');
const { calculateMrr } = require('./mrr');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a "YYYY-MM" key from a Date using UTC */
function utcKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Human-readable month label using UTC */
function utcLabel(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Add n months (UTC-safe) */
function addMonthsUTC(date, n) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * getDashboardSummary()
 * Returns live aggregate KPIs: MRR, ARR, active subs, churn, overdue count, etc.
 */
async function getDashboardSummary() {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endOfMonth   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  // Active subscriptions with plan info
  const activeSubs = await Subscription.find({
    status: { $in: ['active', 'confirmed'] },
  }).populate('plan').lean();

  const totalMrr = activeSubs.reduce((acc, sub) => {
    const period = sub.plan?.billingPeriod || 'monthly';
    return acc + calculateMrr(sub, period);
  }, 0);

  const totalArr = round2(totalMrr * 12);
  const mrrRounded = round2(totalMrr);

  // Churn: subscriptions closed this month
  const churnedThisMonth = await Subscription.countDocuments({
    status: 'closed',
    closedAt: { $gte: startOfMonth, $lte: endOfMonth },
  });

  // New this month
  const newThisMonth = await Subscription.countDocuments({
    status: { $in: ['active', 'confirmed'] },
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  });

  // Overdue invoices: confirmed but balance > 0 and dueDate < now
  const overdueCount = await Invoice.countDocuments({
    status: { $in: ['confirmed'] },
    balance: { $gt: 0 },
    dueDate: { $lt: now },
  });

  // Revenue collected this month
  const revenueAgg = await Invoice.aggregate([
    { $match: { issueDate: { $gte: startOfMonth, $lte: endOfMonth }, amountPaid: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$amountPaid' } } },
  ]);
  const revenueThisMonth = round2(revenueAgg[0]?.total || 0);

  // Total outstanding balance
  const outstandingAgg = await Invoice.aggregate([
    { $match: { status: { $in: ['confirmed', 'draft'] }, balance: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);
  const outstanding = round2(outstandingAgg[0]?.total || 0);

  // ARPU
  const arpu = activeSubs.length > 0 ? round2(mrrRounded / activeSubs.length) : 0;

  // LTV estimate
  const totalClosedEver = await Subscription.countDocuments({ status: 'closed' });
  const totalEver = await Subscription.countDocuments();
  const churnRate = totalEver > 0 ? totalClosedEver / totalEver : 0;
  const ltv = churnRate > 0 ? round2(arpu / churnRate) : 0;

  return {
    mrr: mrrRounded,
    arr: totalArr,
    activeSubscriptions: activeSubs.length,
    newThisMonth,
    churnedThisMonth,
    churnRate: round2(churnRate * 100),
    arpu,
    ltv,
    overdueCount,
    revenueThisMonth,
    outstanding,
  };
}

// ─── MRR Waterfall ─────────────────────────────────────────────────────────────

async function getMrrWaterfall(months = 12) {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  // Aggregate MrrChange events by UTC month and type
  const changes = await MrrChange.aggregate([
    { $match: { at: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$at' },
          month: { $month: '$at' },
          type: '$type',
        },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // Build map: "YYYY-MM" -> { new, expansion, contraction, churn }
  const changeMap = {};
  for (const c of changes) {
    const key = `${c._id.year}-${String(c._id.month).padStart(2, '0')}`;
    if (!changeMap[key]) changeMap[key] = { new: 0, expansion: 0, contraction: 0, churn: 0 };
    changeMap[key][c._id.type] = round2(c.total);
  }

  const hasData = Object.keys(changeMap).length > 0;
  if (!hasData) {
    return await getFallbackWaterfall(months);
  }

  // Build periods array using UTC
  const periods = [];
  let runningMrr = 0;
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1));
    const key = utcKey(d);
    const label = utcLabel(d);
    const delta = changeMap[key] || {};
    const newMrr     = delta.new || 0;
    const expansion  = delta.expansion || 0;
    const contraction = delta.contraction || 0;
    const churn      = delta.churn || 0;

    runningMrr = round2(Math.max(0, runningMrr + newMrr + expansion - contraction - churn));

    periods.push({ period: key, label, mrr: runningMrr, arr: round2(runningMrr * 12), new: newMrr, expansion, contraction, churn });
  }

  return periods;
}

async function getFallbackWaterfall(months) {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const activeSubs = await Subscription.find({
    status: { $in: ['active', 'confirmed'] },
    createdAt: { $lte: now },
  }).populate('plan').lean();

  const periods = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1));
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const key = utcKey(d);
    const label = utcLabel(d);

    const activeDuringMonth = activeSubs.filter((sub) => {
      const created = new Date(sub.createdAt);
      const closed = sub.closedAt ? new Date(sub.closedAt) : null;
      return created <= monthEnd && (!closed || closed >= d);
    });

    const mrr = round2(
      activeDuringMonth.reduce((acc, sub) => {
        const period = sub.plan?.billingPeriod || 'monthly';
        return acc + calculateMrr(sub, period);
      }, 0)
    );

    periods.push({ period: key, label, mrr, arr: round2(mrr * 12), new: 0, expansion: 0, contraction: 0, churn: 0 });
  }
  return periods;
}

// ─── Revenue by period ─────────────────────────────────────────────────────────

async function getRevenueBreakdown(months = 12) {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const agg = await Invoice.aggregate([
    { $match: { issueDate: { $gte: startDate }, amountPaid: { $gt: 0 } } },
    {
      $group: {
        _id: { year: { $year: '$issueDate' }, month: { $month: '$issueDate' } },
        revenue: { $sum: '$amountPaid' },
        invoiceCount: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const revenueMap = {};
  for (const r of agg) {
    const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
    revenueMap[key] = { revenue: round2(r.revenue), invoiceCount: r.invoiceCount };
  }

  const result = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1));
    const key = utcKey(d);
    const label = utcLabel(d);
    result.push({
      period: key,
      label,
      revenue: revenueMap[key]?.revenue || 0,
      invoiceCount: revenueMap[key]?.invoiceCount || 0,
    });
  }
  return result;
}

// ─── Churn analysis ────────────────────────────────────────────────────────────

async function getChurnAnalysis(months = 12) {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const newAgg = await Subscription.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
  ]);

  const churnAgg = await Subscription.aggregate([
    { $match: { status: 'closed', closedAt: { $gte: startDate } } },
    { $group: { _id: { year: { $year: '$closedAt' }, month: { $month: '$closedAt' } }, count: { $sum: 1 } } },
  ]);

  const newMap = {};
  for (const r of newAgg) {
    newMap[`${r._id.year}-${String(r._id.month).padStart(2, '0')}`] = r.count;
  }
  const churnMap = {};
  for (const r of churnAgg) {
    churnMap[`${r._id.year}-${String(r._id.month).padStart(2, '0')}`] = r.count;
  }

  const result = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + i, 1));
    const key = utcKey(d);
    const label = utcLabel(d);
    result.push({
      period: key,
      label,
      new: newMap[key] || 0,
      churned: churnMap[key] || 0,
      net: (newMap[key] || 0) - (churnMap[key] || 0),
    });
  }
  return result;
}

module.exports = {
  getDashboardSummary,
  getMrrWaterfall,
  getRevenueBreakdown,
  getChurnAnalysis,
};
