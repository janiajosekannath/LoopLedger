/**
 * routes/history.js
 */

const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:entityType/:entityId', historyController.getHistory);

module.exports = router;
