/**
 * routes/reminders.js
 */

const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin', 'staff'));

router.get('/', reminderController.listReminders);
router.post('/run', reminderController.triggerReminders);

module.exports = router;
