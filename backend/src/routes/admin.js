const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.post('/staff', adminController.createStaff);
router.get('/staff', adminController.listStaff);
router.patch('/staff/:id/toggle', adminController.toggleStaff);

module.exports = router;
