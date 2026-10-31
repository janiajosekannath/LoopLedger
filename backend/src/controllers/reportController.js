/**
 * controllers/reportController.js
 * Phase 7 – Reports & Dashboard analytics
 */

const asyncHandler = require('../utils/asyncHandler');
const {
  getDashboardSummary,
  getMrrWaterfall,
  getRevenueBreakdown,
  getChurnAnalysis,
} = require('../services/reportsService');

// GET /api/reports/summary
exports.summary = asyncHandler(async (req, res) => {
  const data = await getDashboardSummary();
  res.json({ success: true, data });
});

// GET /api/reports/mrr-waterfall?months=12
exports.mrrWaterfall = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(1, parseInt(req.query.months) || 12), 36);
  const data = await getMrrWaterfall(months);
  res.json({ success: true, data });
});

// GET /api/reports/revenue?months=12
exports.revenue = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(1, parseInt(req.query.months) || 12), 36);
  const data = await getRevenueBreakdown(months);
  res.json({ success: true, data });
});

// GET /api/reports/churn?months=12
exports.churn = asyncHandler(async (req, res) => {
  const months = Math.min(Math.max(1, parseInt(req.query.months) || 12), 36);
  const data = await getChurnAnalysis(months);
  res.json({ success: true, data });
});
