/**
 * routes/billingRuns.js
 */

const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin', 'staff'));

router.get('/', billingController.listRuns);
router.get('/:id', billingController.getRun);

module.exports = router;
