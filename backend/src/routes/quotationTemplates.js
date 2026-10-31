/**
 * routes/quotationTemplates.js
 */

const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', templateController.listTemplates);
router.get('/:id', templateController.getTemplate);

router.post('/', authorize('admin', 'staff'), templateController.createTemplate);
router.put('/:id', authorize('admin', 'staff'), templateController.updateTemplate);
router.delete('/:id', authorize('admin', 'staff'), templateController.deleteTemplate);

module.exports = router;
