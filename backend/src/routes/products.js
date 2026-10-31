const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const productController = require('../controllers/productController');

router.use(authenticate);

// Staff and Admin can view products
router.get('/', authorize('admin', 'staff'), productController.listProducts);
router.get('/:id', authorize('admin', 'staff'), productController.getProduct);

// Admin only can create, edit, delete, and manage variants
router.post('/', authorize('admin'), productController.createProduct);
router.put('/:id', authorize('admin'), productController.updateProduct);
router.delete('/:id', authorize('admin'), productController.deleteProduct);

router.post('/:id/variants', authorize('admin'), productController.addVariant);
router.put('/:id/variants/:variantId', authorize('admin'), productController.updateVariant);
router.delete('/:id/variants/:variantId', authorize('admin'), productController.deleteVariant);

module.exports = router;
