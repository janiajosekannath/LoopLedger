const mongoose = require('mongoose');

const taxSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    description: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tax', taxSchema);
