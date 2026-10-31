const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const taxController = require('../controllers/taxController');

router.use(authenticate);

// Staff and Admin can read
router.get('/', authorize('admin', 'staff'), taxController.listTaxes);
router.get('/:id', authorize('admin', 'staff'), taxController.getTax);

// Admin only can write
router.post('/', authorize('admin'), taxController.createTax);
router.put('/:id', authorize('admin'), taxController.updateTax);
router.patch('/:id/toggle', authorize('admin'), taxController.toggleTax);
router.delete('/:id', authorize('admin'), taxController.deleteTax);

module.exports = router;
