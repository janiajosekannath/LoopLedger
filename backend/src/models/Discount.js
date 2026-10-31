const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['fixed', 'percent'], required: true },
    value: { type: Number, required: true, min: 0 },
    minPurchase: { type: Number, default: 0, min: 0 },
    minQty: { type: Number, default: 0, min: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    usageLimit: { type: Number, default: null },
    timesUsed: { type: Number, default: 0 },
    scope: { type: String, enum: ['product', 'subscription'], required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Discount', discountSchema);
