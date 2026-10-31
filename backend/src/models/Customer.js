const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    address: addressSchema,
    registeredAt: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

customerSchema.index({ name: 'text', email: 'text', company: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
