const mongoose = require('mongoose');

const productVariantSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    attribute: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    extraPrice: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

productVariantSchema.index({ product: 1, attribute: 1, value: 1 }, { unique: true });

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['service', 'physical', 'digital', 'subscription'],
      default: 'service',
    },
    salesPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    notes: { type: String },
    tax: { type: mongoose.Schema.Types.ObjectId, ref: 'Tax' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text' });

const Product = mongoose.model('Product', productSchema);
const ProductVariant = mongoose.model('ProductVariant', productVariantSchema);

module.exports = { Product, ProductVariant };
