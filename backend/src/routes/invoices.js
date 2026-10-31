/**
 * routes/invoices.js
 */

const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const paymentController = require('../controllers/paymentController');
const collectionController = require('../controllers/collectionController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// List invoices (admin, staff, customer-scoped)
router.get('/', invoiceController.listInvoices);

// Manual create (admin, staff)
router.post('/', authorize('admin', 'staff'), invoiceController.createInvoice);

// Get single invoice (admin, staff, customer-scoped)
router.get('/:id', invoiceController.getInvoice);

// Download PDF (admin, staff, customer-scoped)
router.get('/:id/pdf', invoiceController.downloadInvoicePDF);

// Confirm draft (admin, staff)
router.patch('/:id/confirm', authorize('admin', 'staff'), invoiceController.confirmInvoice);

// Cancel invoice (admin, staff)
router.patch('/:id/cancel', authorize('admin', 'staff'), invoiceController.cancelInvoice);

// Send invoice via email (admin, staff)
router.post('/:id/send', authorize('admin', 'staff'), invoiceController.sendInvoice);

// Send on-demand payment reminder for invoice (admin, staff)
router.post('/:id/remind', authorize('admin', 'staff'), collectionController.remindInvoice);

// Record payment against invoice: POST /api/invoices/:id/payments
router.post('/:id/payments', (req, res, next) => {
  req.params.invoiceId = req.params.id;
  return paymentController.payInvoice(req, res, next);
});

// List payments for invoice: GET /api/invoices/:id/payments
router.get('/:id/payments', (req, res, next) => {
  req.query.invoice = req.params.id;
  return paymentController.listPayments(req, res, next);
});

module.exports = router;
