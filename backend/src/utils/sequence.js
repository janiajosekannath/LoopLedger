const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * nextSequence — atomically increments and returns the next sequence number
 * for the given prefix, returning a zero-padded document number.
 *
 * Examples: nextSequence('INV') => 'INV-000001'
 */
const nextSequence = async (prefix) => {
  const counter = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const padded = String(counter.seq).padStart(6, '0');
  return `${prefix}-${padded}`;
};

module.exports = { nextSequence, Counter };
