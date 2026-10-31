const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'staff', 'customer'], required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    isActive: { type: Boolean, default: true },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Never expose sensitive fields
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.resetTokenHash;
  delete obj.resetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
