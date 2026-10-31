const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'upi', 'other'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    paidOn: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ['completed', 'refunded'],
      default: 'completed',
      index: true,
    },
    transactionId: { type: String },
    refundReason: { type: String },
    refundedAt: { type: Date },
    note: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.index({ customer: 1, paidOn: -1 });
paymentSchema.index({ invoice: 1, paidOn: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
