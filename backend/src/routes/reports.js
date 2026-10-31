/**
 * routes/reports.js
 * Phase 7 – Reports & Dashboard analytics
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin', 'staff'));

router.get('/summary', reportController.summary);
router.get('/mrr-waterfall', reportController.mrrWaterfall);
router.get('/revenue', reportController.revenue);
router.get('/churn', reportController.churn);

module.exports = router;
