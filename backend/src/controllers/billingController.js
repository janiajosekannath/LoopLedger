/**
 * controllers/billingController.js
 */

const asyncHandler = require('../utils/asyncHandler');
const { runBilling } = require('../services/billingEngine');
const BillingRun = require('../models/BillingRun');

// POST /api/billing/run
// Body: { asOf: "2026-11-01", dryRun: true/false }
exports.run = asyncHandler(async (req, res) => {
  const { asOf, dryRun } = req.body;
  const result = await runBilling({
    asOf: asOf ? new Date(asOf) : new Date(),
    dryRun: !!dryRun,
    triggeredBy: req.user ? req.user.email : 'system',
  });
  res.json({ success: true, data: result });
});

// GET /api/billing/runs or /api/billing-runs
exports.listRuns = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const lim = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const pg = Math.max(1, parseInt(page) || 1);

  const [runs, total] = await Promise.all([
    BillingRun.find()
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ runAt: -1 })
      .lean(),
    BillingRun.countDocuments(),
  ]);

  res.json({
    success: true,
    data: runs,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

// GET /api/billing/runs/:id or /api/billing-runs/:id
exports.getRun = asyncHandler(async (req, res) => {
  const run = await BillingRun.findById(req.params.id)
    .populate('details.subscription', 'number plan customer')
    .populate('details.invoice', 'number total balance status')
    .lean();

  if (!run) {
    return res.status(404).json({ success: false, message: 'Billing run not found' });
  }

  res.json({ success: true, data: run });
});
