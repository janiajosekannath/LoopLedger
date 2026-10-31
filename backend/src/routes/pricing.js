/**
 * routes/pricing.js
 */

const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/quote', pricingController.calculateQuote);

module.exports = router;
