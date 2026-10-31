/**
 * models/ReminderLog.js
 * Tracks automated payment reminders & dunning logs sent for overdue invoices.
 */

const mongoose = require('mongoose');

const reminderLogSchema = new mongoose.Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms'],
      default: 'email',
    },
    sentBy: {
      type: String,
      default: 'system',
    },
    recipient: {
      type: String,
    },
    messageId: {
      type: String,
    },
    previewUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed'],
      default: 'sent',
    },
  },
  { timestamps: true }
);

reminderLogSchema.index({ invoice: 1, sentAt: -1 });

module.exports = mongoose.models.ReminderLog || mongoose.model('ReminderLog', reminderLogSchema);
