const mongoose = require('mongoose');

const billingRunDetailSchema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  periodStart: { type: Date, required: true },
  outcome: { type: String, enum: ['created','skipped','failed'], required: true },
  reason: { type: String },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
}, { _id: false });

const billingRunSchema = new mongoose.Schema({
  runAt: { type: Date, default: Date.now },
  mode: { type: String, enum: ['live','dry'], required: true },
  asOf: { type: Date, required: true },
  triggeredBy: { type: String },
  createdCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  details: [billingRunDetailSchema],
}, { timestamps: true });

module.exports = mongoose.models.BillingRun || mongoose.model('BillingRun', billingRunSchema);
