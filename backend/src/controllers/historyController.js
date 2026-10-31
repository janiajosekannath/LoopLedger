/**
 * controllers/historyController.js
 */

const asyncHandler = require('../utils/asyncHandler');
const { getEntityHistory } = require('../services/audit');
const Quotation = require('../models/Quotation');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const { createError } = require('../middleware/errorHandler');

exports.getHistory = asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;

  // Customers can only see history for their own records
  if (req.user.role === 'customer') {
    let owned = false;
    if (entityType === 'quotation') {
      const q = await Quotation.findById(entityId).lean();
      if (q && q.customer?.toString() === req.user.customerId) owned = true;
    } else if (entityType === 'subscription') {
      const s = await Subscription.findById(entityId).lean();
      if (s && s.customer?.toString() === req.user.customerId) owned = true;
    } else if (entityType === 'invoice') {
      const inv = await Invoice.findById(entityId).lean();
      if (inv && inv.customer?.toString() === req.user.customerId) owned = true;
    }
    if (!owned) {
      throw createError(403, 'Forbidden');
    }
  }

  const history = await getEntityHistory(entityType, entityId, 'desc');

  res.json({
    success: true,
    data: history,
  });
});
