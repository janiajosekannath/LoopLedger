const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
    description: { type: String },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    tax: { type: mongoose.Schema.Types.ObjectId, ref: 'Tax' },
    taxAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const appliedDiscountSchema = new mongoose.Schema(
  {
    discount: { type: mongoose.Schema.Types.ObjectId, ref: 'Discount' },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', index: true },
    billingPeriodStart: { type: Date },
    billingPeriodEnd: { type: Date },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    lines: [invoiceLineSchema],
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'paid', 'cancelled'],
      default: 'draft',
      index: true,
    },
    appliedDiscounts: [appliedDiscountSchema],
    sentAt: { type: Date },
  },
  { timestamps: true }
);

invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ customer: 1, status: 1 });
invoiceSchema.index({ subscription: 1, status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
