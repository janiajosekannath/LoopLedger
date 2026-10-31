const mongoose = require('mongoose');

const billingPeriodSchema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  runId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillingRun' },
}, {
  timestamps: true,
});

// Unique claim per subscription + periodStart ensures idempotency
billingPeriodSchema.index({ subscription: 1, periodStart: 1 }, { unique: true });

module.exports = mongoose.models.BillingPeriod || mongoose.model('BillingPeriod', billingPeriodSchema);
