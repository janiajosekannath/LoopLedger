const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    from: { type: String },
    to: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    note: { type: String },
  },
  { timestamps: false }
);

statusHistorySchema.index({ entityType: 1, entityId: 1, at: -1 });

const reminderLogSchema = new mongoose.Schema(
  {
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
    sentAt: { type: Date, default: Date.now },
    channel: { type: String, default: 'email' },
    sentBy: { type: String, default: 'system' },
    recipient: { type: String },
    messageId: { type: String },
    previewUrl: { type: String },
    status: { type: String, default: 'sent' },
  },
  { timestamps: true }
);

const mrrChangeSchema = new mongoose.Schema(
  {
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
    at: { type: Date, default: Date.now, index: true },
    type: { type: String, enum: ['new', 'expansion', 'contraction', 'churn'], required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: false }
);

mrrChangeSchema.index({ at: -1 });

const StatusHistory = mongoose.models.StatusHistory || mongoose.model('StatusHistory', statusHistorySchema);
const ReminderLog = mongoose.models.ReminderLog || mongoose.model('ReminderLog', reminderLogSchema);
const MrrChange = mongoose.models.MrrChange || mongoose.model('MrrChange', mrrChangeSchema);

module.exports = { StatusHistory, ReminderLog, MrrChange };
