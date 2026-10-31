const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    price: { type: Number, required: true, min: 0 },
    billingPeriod: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      required: true,
    },
    minQty: { type: Number, default: 1, min: 1 },
    availableFrom: { type: Date },
    availableTo: { type: Date },
    autoClose: { type: Boolean, default: false },
    allowEarlyClose: { type: Boolean, default: true },
    allowPause: { type: Boolean, default: true },
    allowRenew: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
