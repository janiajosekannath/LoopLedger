/**
 * routes/collections.js
 * Collections Cockpit routes for admin & staff.
 */

const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collectionController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin', 'staff'));

// GET /api/collections/aging
router.get('/aging', collectionController.getAgingReport);

module.exports = router;
