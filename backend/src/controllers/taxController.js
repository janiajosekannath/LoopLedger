const { z } = require('zod');
const Tax = require('../models/Tax');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');

const taxSchema = z.object({
  name: z.string().min(1, 'Tax name is required'),
  percent: z.number().min(0, 'Tax percentage cannot be negative').max(100, 'Tax percentage cannot exceed 100'),
  description: z.string().optional().default(''),
  active: z.boolean().optional().default(true),
});

// GET /api/taxes
exports.listTaxes = asyncHandler(async (req, res) => {
  const { search, active } = req.query;
  const filter = {};

  if (active !== undefined) {
    filter.active = active === 'true' || active === true;
  }
  if (search) {
    filter.name = { $regex: search.trim(), $options: 'i' };
  }

  const taxes = await Tax.find(filter).sort({ percent: 1, name: 1 }).lean();

  res.json({
    success: true,
    data: taxes,
  });
});

// GET /api/taxes/:id
exports.getTax = asyncHandler(async (req, res) => {
  const tax = await Tax.findById(req.params.id).lean();
  if (!tax) throw createError(404, 'Tax rule not found');

  res.json({
    success: true,
    data: tax,
  });
});

// POST /api/taxes
exports.createTax = asyncHandler(async (req, res) => {
  const data = taxSchema.parse(req.body);

  const existing = await Tax.findOne({ name: { $regex: `^${data.name.trim()}$`, $options: 'i' } });
  if (existing) throw createError(409, 'A tax rule with this name already exists');

  const tax = await Tax.create(data);

  res.status(201).json({
    success: true,
    data: tax,
  });
});

// PUT /api/taxes/:id
exports.updateTax = asyncHandler(async (req, res) => {
  const data = taxSchema.partial().parse(req.body);

  const tax = await Tax.findById(req.params.id);
  if (!tax) throw createError(404, 'Tax rule not found');

  if (data.name && data.name.trim().toLowerCase() !== tax.name.toLowerCase()) {
    const existing = await Tax.findOne({ name: { $regex: `^${data.name.trim()}$`, $options: 'i' } });
    if (existing) throw createError(409, 'A tax rule with this name already exists');
    tax.name = data.name.trim();
  }

  if (data.percent !== undefined) tax.percent = data.percent;
  if (data.description !== undefined) tax.description = data.description;
  if (data.active !== undefined) tax.active = data.active;

  await tax.save();

  res.json({
    success: true,
    data: tax,
  });
});

// PATCH /api/taxes/:id/toggle
exports.toggleTax = asyncHandler(async (req, res) => {
  const tax = await Tax.findById(req.params.id);
  if (!tax) throw createError(404, 'Tax rule not found');

  tax.active = !tax.active;
  await tax.save();

  res.json({
    success: true,
    data: tax,
  });
});

// DELETE /api/taxes/:id
exports.deleteTax = asyncHandler(async (req, res) => {
  const tax = await Tax.findById(req.params.id);
  if (!tax) throw createError(404, 'Tax rule not found');

  await Tax.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Tax deleted successfully',
  });
});
