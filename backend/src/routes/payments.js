/**
 * routes/payments.js
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', paymentController.listPayments);
router.get('/:id', paymentController.getPayment);

// Record payment (Admin/Staff only)
router.post('/', authorize('admin', 'staff'), paymentController.createPayment);

module.exports = router;
