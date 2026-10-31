/**
 * routes/subscriptions.js
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', subscriptionController.listSubscriptions);
router.get('/:id', subscriptionController.getSubscription);

// Admin / Staff write actions
router.post('/', authorize('admin', 'staff'), subscriptionController.createSubscription);
router.post('/:id/activate', authorize('admin', 'staff'), subscriptionController.activateSubscription);

// Lifecycle transitions (Staff / Admin, and Customers can pause/close/renew subject to plan policy flags)
router.post('/:id/pause', subscriptionController.pauseSubscription);
router.post('/:id/resume', subscriptionController.resumeSubscription);
router.post('/:id/close', subscriptionController.closeSubscription);
router.post('/:id/renew', subscriptionController.renewSubscription);

module.exports = router;
