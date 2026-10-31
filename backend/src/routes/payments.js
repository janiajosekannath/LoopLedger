/**
 * routes/payments.js
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

// Public Webhook route (mock external gateway)
router.post('/webhook', paymentController.handleWebhook);

// Authenticated routes
router.use(authenticate);

router.get('/', paymentController.listPayments);
router.get('/:id', paymentController.getPayment);

// Pay specific invoice (Customer can pay own invoice; Admin/Staff can pay any invoice)
router.post('/:invoiceId/pay', paymentController.payInvoice);

// General payment create (Admin/Staff only)
router.post('/', authorize('admin', 'staff'), paymentController.createPayment);

// Refund payment (Admin/Staff only)
router.patch('/:id/refund', authorize('admin', 'staff'), paymentController.refundPayment);

module.exports = router;
