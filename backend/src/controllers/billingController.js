const asyncHandler = require('../middleware/asyncHandler');
const { runBilling } = require('../services/billingEngine');
const { protect, authorize } = require('../middleware/auth');

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
