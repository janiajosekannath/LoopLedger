const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const User = require('../models/User');
const Customer = require('../models/Customer');
const { sendMail } = require('../config/mailer');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');

const passwordSchema = z
  .string()
  .min(9, 'Password must be at least 9 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

const signToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role, customerId: user.customer?.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// POST /api/auth/signup
exports.signup = asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: passwordSchema,
    phone: z.string().optional(),
    company: z.string().optional(),
  });

  const data = schema.parse(req.body);
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw createError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(data.password, 12);

  // Create customer record first
  const customer = await Customer.create({
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    company: data.company,
  });

  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash,
    role: 'customer',
    customer: customer._id,
  });

  // Link user to customer
  customer.user = user._id;
  await customer.save();

  const token = signToken(user);
  res.status(201).json({ success: true, data: { token, user } });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const data = schema.parse(req.body);

  const user = await User.findOne({ email: data.email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive) throw createError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw createError(401, 'Invalid credentials');

  const token = signToken(user);
  const safeUser = user.toJSON();
  res.json({ success: true, data: { token, user: safeUser } });
});

// POST /api/auth/forgot-password
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);

  // Always return 200 – do not reveal whether email exists
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetTokenHash = tokenHash;
    user.resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;
    try {
      const result = await sendMail({
        to: user.email,
        subject: 'LoopLedger – Password Reset',
        html: `<p>Click below to reset your password (expires in 30 minutes):</p>
               <p><a href="${resetUrl}">${resetUrl}</a></p>`,
        text: `Reset your password: ${resetUrl}`,
      });
      if (result.previewUrl) console.log('Password reset preview:', result.previewUrl);
    } catch (e) {
      console.error('Email send error:', e.message);
    }
  }

  res.json({ success: true, data: { message: 'If that email exists you will receive a reset link.' } });
});

// POST /api/auth/reset-password
exports.resetPassword = asyncHandler(async (req, res) => {
  const schema = z.object({
    token: z.string().min(1),
    password: passwordSchema,
  });
  const { token, password } = schema.parse(req.body);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetExpires: { $gt: new Date() },
  }).select('+resetTokenHash +resetExpires +passwordHash');

  if (!user) throw createError(400, 'Invalid or expired reset token');

  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetTokenHash = undefined;
  user.resetExpires = undefined;
  await user.save();

  res.json({ success: true, data: { message: 'Password reset successful' } });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).populate('customer');
  if (!user) throw createError(404, 'User not found');
  res.json({ success: true, data: { user } });
});
