/**
 * controllers/collectionController.js
 * Collections cockpit & aging analysis for LoopLedger.
 */

const Invoice = require('../models/Invoice');
const ReminderLog = require('../models/ReminderLog');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/money');
const { sendPaymentReminderEmail } = require('../utils/mailer');

/**
 * GET /api/collections/aging
 * Returns overdue aging buckets (1-7, 8-30, 31-60, 60+ days) and overdue invoices list.
 */
exports.getAgingReport = asyncHandler(async (req, res) => {
  const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();

  // Overdue = confirmed, balance > 0, dueDate < asOf
  const overdueInvoices = await Invoice.find({
    status: 'confirmed',
    balance: { $gt: 0 },
    dueDate: { $lt: asOf },
  })
    .populate('customer', 'name email company phone')
    .sort({ dueDate: 1 })
    .lean();

  const buckets = {
    '1-7': { count: 0, amount: 0 },
    '8-30': { count: 0, amount: 0 },
    '31-60': { count: 0, amount: 0 },
    '60+': { count: 0, amount: 0 },
  };

  let totalCount = 0;
  let totalAmount = 0;

  // Fetch latest reminder for each overdue invoice in bulk
  const invoiceIds = overdueInvoices.map((inv) => inv._id);
  const latestLogs = await ReminderLog.aggregate([
    { $match: { invoice: { $in: invoiceIds }, status: 'sent' } },
    { $sort: { sentAt: -1 } },
    {
      $group: {
        _id: '$invoice',
        lastSentAt: { $first: '$sentAt' },
        lastChannel: { $first: '$channel' },
      },
    },
  ]);

  const reminderMap = new Map();
  latestLogs.forEach((log) => reminderMap.set(String(log._id), log));

  const enrichedInvoices = overdueInvoices.map((inv) => {
    const diffMs = asOf - new Date(inv.dueDate);
    const daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const balance = round2(inv.balance || 0);

    totalCount += 1;
    totalAmount = round2(totalAmount + balance);

    if (daysOverdue <= 7) {
      buckets['1-7'].count += 1;
      buckets['1-7'].amount = round2(buckets['1-7'].amount + balance);
    } else if (daysOverdue <= 30) {
      buckets['8-30'].count += 1;
      buckets['8-30'].amount = round2(buckets['8-30'].amount + balance);
    } else if (daysOverdue <= 60) {
      buckets['31-60'].count += 1;
      buckets['31-60'].amount = round2(buckets['31-60'].amount + balance);
    } else {
      buckets['60+'].count += 1;
      buckets['60+'].amount = round2(buckets['60+'].amount + balance);
    }

    const remInfo = reminderMap.get(String(inv._id));

    return {
      ...inv,
      daysOverdue,
      lastReminderSentAt: remInfo?.lastSentAt || null,
      lastReminderChannel: remInfo?.lastChannel || null,
    };
  });

  res.json({
    success: true,
    data: {
      asOf: asOf.toISOString(),
      buckets,
      totalOverdue: {
        count: totalCount,
        amount: totalAmount,
      },
      invoices: enrichedInvoices,
    },
  });
});

/**
 * POST /api/invoices/:id/remind
 * Sends an on-demand payment reminder email for a specific overdue invoice.
 */
exports.remindInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await Invoice.findById(id).populate('customer');

  if (!invoice) {
    return res.status(404).json({ success: false, message: 'Invoice not found' });
  }

  if (invoice.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: `Cannot send reminder for invoice with status "${invoice.status}". Must be confirmed.`,
    });
  }

  if (invoice.balance <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invoice has zero balance due.',
    });
  }

  const customer = invoice.customer;
  if (!customer || !customer.email) {
    return res.status(400).json({
      success: false,
      message: 'Invoice customer has no valid email address.',
    });
  }

  const emailResult = await sendPaymentReminderEmail({ customer, invoice });

  const log = await ReminderLog.create({
    invoice: invoice._id,
    customer: customer._id,
    channel: 'email',
    sentAt: new Date(),
    sentBy: req.user ? req.user.email || req.user.name || 'staff' : 'staff',
    recipient: customer.email,
    messageId: emailResult?.messageId,
    previewUrl: emailResult?.previewUrl,
    status: 'sent',
  });

  res.json({
    success: true,
    message: `Reminder sent to ${customer.email}`,
    data: {
      log,
      previewUrl: emailResult?.previewUrl,
    },
  });
});
