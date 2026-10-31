const mongoose = require('mongoose');

const lineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
    description: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    tax: { type: mongoose.Schema.Types.ObjectId, ref: 'Tax' },
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date },
    paymentTerms: {
      type: String,
      enum: ['immediate', 'net15', 'net30', 'net45'],
      default: 'immediate',
    },
    lines: [lineSchema],
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'quotation', 'confirmed', 'active', 'paused', 'closed'],
      default: 'draft',
      index: true,
    },
    nextBillingDate: { type: Date, index: true },
    pausedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

subscriptionSchema.index({ customer: 1, status: 1 });
subscriptionSchema.index({ status: 1, nextBillingDate: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
