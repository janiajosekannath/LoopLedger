const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const customerController = require('../controllers/customerController');

router.use(authenticate);

// Admin & Staff full customer CRUD
router.get('/', authorize('admin', 'staff'), customerController.listCustomers);
router.post('/', authorize('admin', 'staff'), customerController.createCustomer);
router.put('/:id', authorize('admin', 'staff'), customerController.updateCustomer);
router.delete('/:id', authorize('admin', 'staff'), customerController.deleteCustomer);

// Detail & sub-resources accessible to admin, staff, and customer (scoped in controller)
router.get('/:id', authorize('admin', 'staff', 'customer'), customerController.getCustomer);
router.get('/:id/subscriptions', authorize('admin', 'staff', 'customer'), customerController.getCustomerSubscriptions);
router.get('/:id/invoices', authorize('admin', 'staff', 'customer'), customerController.getCustomerInvoices);
router.get('/:id/payments', authorize('admin', 'staff', 'customer'), customerController.getCustomerPayments);

module.exports = router;
