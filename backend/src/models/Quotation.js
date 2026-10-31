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

const quotationSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'QuotationTemplate' },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    lines: [lineSchema],
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    validUntil: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'quotation', 'confirmed'],
      default: 'draft',
      index: true,
    },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quotation', quotationSchema);
