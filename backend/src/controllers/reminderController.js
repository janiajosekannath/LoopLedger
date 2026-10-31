/**
 * controllers/reminderController.js
 * Admin & staff access to overdue payment reminder / dunning logs.
 */

const ReminderLog = require('../models/ReminderLog');
const asyncHandler = require('../utils/asyncHandler');
const { remindOverdue } = require('../jobs/paymentReminders');

exports.listReminders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, invoice, customer, channel } = req.query;
  const lim = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const pg = Math.max(1, parseInt(page) || 1);

  const filter = {};
  if (invoice) filter.invoice = invoice;
  if (customer) filter.customer = customer;
  if (channel) filter.channel = channel;

  const [reminders, total] = await Promise.all([
    ReminderLog.find(filter)
      .populate({
        path: 'invoice',
        select: 'number total balance dueDate status',
      })
      .populate({
        path: 'customer',
        select: 'name email company phone',
      })
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ sentAt: -1 })
      .lean(),
    ReminderLog.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: reminders,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

exports.triggerReminders = asyncHandler(async (req, res) => {
  const result = await remindOverdue({
    asOf: new Date(),
    sentBy: req.user ? req.user.email || req.user.userId : 'admin',
  });

  res.json({
    success: true,
    data: result,
  });
});
