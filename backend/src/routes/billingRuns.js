const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { listRuns, getRun } = require('../controllers/billingRunController');

const router = express.Router();

// List all billing runs (admin / staff only)
router.get('/', protect, authorize('admin','staff'), listRuns);

// Get details of a specific run
router.get('/:id', protect, authorize('admin','staff'), getRun);

module.exports = router;
