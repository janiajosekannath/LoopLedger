/**
 * routes/billing.js
 */

const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin', 'staff'));

router.post('/run', billingController.run);
router.get('/runs', billingController.listRuns);
router.get('/runs/:id', billingController.getRun);

module.exports = router;
