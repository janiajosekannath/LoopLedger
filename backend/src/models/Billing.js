const mongoose = require('mongoose');

const billingPeriodSchema = new mongoose.Schema(
  {
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    runId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingRun' },
  },
  { timestamps: true }
);

billingPeriodSchema.index({ subscription: 1, periodStart: 1 }, { unique: true });

const billingRunDetailSchema = new mongoose.Schema(
  {
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    periodStart: { type: Date },
    outcome: { type: String, enum: ['created', 'skipped', 'failed'] },
    reason: { type: String },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  },
  { _id: false }
);

const billingRunSchema = new mongoose.Schema(
  {
    runAt: { type: Date, default: Date.now },
    mode: { type: String, enum: ['live', 'dry'], required: true },
    asOf: { type: Date, required: true },
    triggeredBy: { type: String, default: 'system' },
    createdCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    details: [billingRunDetailSchema],
  },
  { timestamps: true }
);

const BillingPeriod = mongoose.models.BillingPeriod || mongoose.model('BillingPeriod', billingPeriodSchema);
const BillingRun = mongoose.models.BillingRun || mongoose.model('BillingRun', billingRunSchema);

module.exports = { BillingPeriod, BillingRun };
