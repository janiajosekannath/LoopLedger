const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const discountController = require('../controllers/discountController');

router.use(authenticate);

// Staff and Admin can view discounts
router.get('/', authorize('admin', 'staff'), discountController.listDiscounts);
router.get('/:id', authorize('admin', 'staff'), discountController.getDiscount);

// Admin only can create, edit, toggle, or delete
router.post('/', authorize('admin'), discountController.createDiscount);
router.put('/:id', authorize('admin'), discountController.updateDiscount);
router.patch('/:id/toggle', authorize('admin'), discountController.toggleDiscount);
router.delete('/:id', authorize('admin'), discountController.deleteDiscount);

module.exports = router;
