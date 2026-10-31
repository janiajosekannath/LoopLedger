const { z } = require('zod');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');

const passwordSchema = z
  .string()
  .min(9, 'Password must be at least 9 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

// POST /api/admin/staff — admin only
exports.createStaff = asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: passwordSchema,
  });
  const data = schema.parse(req.body);

  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw createError(409, 'Email already registered');

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash,
    role: 'staff',
  });

  res.status(201).json({ success: true, data: { user } });
});

// GET /api/admin/staff — admin only
exports.listStaff = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const lim = Math.min(parseInt(limit), 100);
  const pg = Math.max(parseInt(page), 1);

  const filter = { role: 'staff' };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: users,
    meta: { page: pg, limit: lim, total, totalPages: Math.ceil(total / lim) },
  });
});

// PATCH /api/admin/staff/:id/toggle — admin only
exports.toggleStaff = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'staff' });
  if (!user) throw createError(404, 'Staff member not found');

  user.isActive = !user.isActive;
  await user.save();
  res.json({ success: true, data: { user } });
});
