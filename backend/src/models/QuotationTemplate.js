const mongoose = require('mongoose');

const templateLineSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false }
);

const quotationTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    validityDays: { type: Number, required: true, default: 30, min: 1 },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    lines: [templateLineSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('QuotationTemplate', quotationTemplateSchema);
