const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const planController = require('../controllers/planController');

router.use(authenticate);

// Staff and Admin can view plans
router.get('/', authorize('admin', 'staff'), planController.listPlans);
router.get('/:id', authorize('admin', 'staff'), planController.getPlan);

// Admin only can write
router.post('/', authorize('admin'), planController.createPlan);
router.put('/:id', authorize('admin'), planController.updatePlan);
router.patch('/:id/toggle', authorize('admin'), planController.togglePlan);
router.delete('/:id', authorize('admin'), planController.deletePlan);

module.exports = router;
