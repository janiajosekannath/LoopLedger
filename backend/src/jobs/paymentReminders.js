/**
 * jobs/paymentReminders.js
 * Scans for overdue invoices (status: 'confirmed', balance > 0, dueDate < now).
 * For each, generates a ReminderLog entry and sends a notification email.
 * Skips invoices that were already reminded in the last 3 days.
 */

const Invoice = require('../models/Invoice');
const ReminderLog = require('../models/ReminderLog');
const { sendPaymentReminderEmail } = require('../utils/mailer');

/**
 * Scan for overdue invoices and send reminders.
 * @param {Object} options
 * @param {Date} [options.asOf] - Evaluation date (defaults to now)
 * @param {string} [options.sentBy] - 'system' or user id
 * @param {number} [options.skipRecentDays] - Days threshold to skip if reminded recently (default 3)
 * @param {boolean} [options.force] - Whether to ignore recent reminder check
 * @returns {Promise<{ scanned: number, sent: number, skipped: number, logs: Array }>}
 */
async function remindOverdue({ asOf = new Date(), sentBy = 'system', skipRecentDays = 3, force = false } = {}) {
  const overdueInvoices = await Invoice.find({
    status: 'confirmed',
    balance: { $gt: 0 },
    dueDate: { $lt: asOf },
  }).populate('customer');

  const results = {
    scanned: overdueInvoices.length,
    sent: 0,
    skipped: 0,
    logs: [],
  };

  const cutoff = new Date(asOf.getTime() - skipRecentDays * 24 * 60 * 60 * 1000);

  for (const invoice of overdueInvoices) {
    const customer = invoice.customer;
    if (!customer || !customer.email) {
      results.skipped++;
      continue;
    }

    // Skip invoices that were successfully reminded within the last skipRecentDays
    if (!force && skipRecentDays > 0) {
      const recentReminder = await ReminderLog.findOne({
        invoice: invoice._id,
        status: 'sent',
        sentAt: { $gte: cutoff },
      });
      if (recentReminder) {
        results.skipped++;
        continue;
      }
    }

    try {
      const emailResult = await sendPaymentReminderEmail({ customer, invoice });

      const log = await ReminderLog.create({
        invoice: invoice._id,
        customer: customer._id,
        channel: 'email',
        sentAt: new Date(),
        sentBy,
        recipient: customer.email,
        messageId: emailResult?.messageId,
        previewUrl: emailResult?.previewUrl,
        status: 'sent',
      });

      results.sent++;
      results.logs.push(log);
    } catch (err) {
      console.error(`Failed to send reminder for invoice ${invoice.number}:`, err.message);

      const failedLog = await ReminderLog.create({
        invoice: invoice._id,
        customer: customer._id,
        channel: 'email',
        sentAt: new Date(),
        sentBy,
        recipient: customer.email,
        status: 'failed',
      });

      results.logs.push(failedLog);
    }
  }

  return results;
}

module.exports = {
  remindOverdue,
};
