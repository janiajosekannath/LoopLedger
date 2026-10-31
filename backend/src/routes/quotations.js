/**
 * routes/quotations.js
 */

const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', quotationController.listQuotations);
router.get('/:id', quotationController.getQuotation);

router.post('/', authorize('admin', 'staff'), quotationController.createQuotation);
router.put('/:id', authorize('admin', 'staff'), quotationController.updateQuotation);
router.patch('/:id/status', authorize('admin', 'staff'), quotationController.updateQuotationStatus);
router.post('/:id/confirm', authorize('admin', 'staff'), quotationController.confirmQuotation);
router.delete('/:id', authorize('admin', 'staff'), quotationController.deleteQuotation);

module.exports = router;
