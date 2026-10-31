/**
 * controllers/templateController.js
 */

const { z } = require('zod');
const QuotationTemplate = require('../models/QuotationTemplate');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');

const templateLineSchema = z.object({
  product: z.string().min(1, 'Product ID is required'),
  variant: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
});

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required').trim(),
  validityDays: z.number().int().min(1).default(30),
  plan: z.string().optional().nullable(),
  lines: z.array(templateLineSchema).default([]),
});

exports.listTemplates = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const lim = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const pg = Math.max(1, parseInt(page) || 1);

  const filter = {};
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  const [templates, total] = await Promise.all([
    QuotationTemplate.find(filter)
      .populate('plan', 'name billingPeriod price')
      .populate('lines.product', 'name salesPrice')
      .populate('lines.variant', 'attribute value extraPrice')
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    QuotationTemplate.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: templates,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

exports.getTemplate = asyncHandler(async (req, res) => {
  const template = await QuotationTemplate.findById(req.params.id)
    .populate('plan')
    .populate('lines.product')
    .populate('lines.variant')
    .lean();

  if (!template) {
    throw createError(404, 'Quotation template not found');
  }

  res.json({
    success: true,
    data: template,
  });
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const data = templateSchema.parse(req.body);

  const template = await QuotationTemplate.create({
    name: data.name,
    validityDays: data.validityDays,
    plan: data.plan || undefined,
    lines: data.lines.map((l) => ({
      product: l.product,
      variant: l.variant || undefined,
      quantity: l.quantity,
    })),
  });

  const populated = await QuotationTemplate.findById(template._id)
    .populate('plan')
    .populate('lines.product')
    .populate('lines.variant');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const data = templateSchema.partial().parse(req.body);

  const template = await QuotationTemplate.findById(req.params.id);
  if (!template) {
    throw createError(404, 'Quotation template not found');
  }

  if (data.name !== undefined) template.name = data.name;
  if (data.validityDays !== undefined) template.validityDays = data.validityDays;
  if (data.plan !== undefined) template.plan = data.plan || null;
  if (data.lines !== undefined) {
    template.lines = data.lines.map((l) => ({
      product: l.product,
      variant: l.variant || undefined,
      quantity: l.quantity,
    }));
  }

  await template.save();

  const populated = await QuotationTemplate.findById(template._id)
    .populate('plan')
    .populate('lines.product')
    .populate('lines.variant');

  res.json({
    success: true,
    data: populated,
  });
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const template = await QuotationTemplate.findByIdAndDelete(req.params.id);
  if (!template) {
    throw createError(404, 'Quotation template not found');
  }

  res.json({
    success: true,
    data: { message: 'Quotation template deleted successfully' },
  });
});
