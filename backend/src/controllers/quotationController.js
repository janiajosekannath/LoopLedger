/**
 * controllers/quotationController.js
 */

const { z } = require('zod');
const Quotation = require('../models/Quotation');
const QuotationTemplate = require('../models/QuotationTemplate');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');
const { nextSequence } = require('../utils/sequence');
const { quote } = require('../services/pricingEngine');
const { recordStatusChange } = require('../services/audit');

const lineSchema = z.object({
  product: z.string().min(1, 'Product ID is required'),
  variant: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  description: z.string().optional(),
  tax: z.string().optional().nullable(),
});

const quotationSchema = z.object({
  customer: z.string().min(1, 'Customer ID is required'),
  template: z.string().optional().nullable(),
  plan: z.string().optional().nullable(),
  validityDays: z.number().int().min(1).optional(),
  validUntil: z.string().datetime().or(z.date()).optional(),
  lines: z.array(lineSchema).min(1, 'At least one line item is required'),
});

exports.listQuotations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status, customer } = req.query;
  const lim = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const pg = Math.max(1, parseInt(page) || 1);

  const filter = {};

  // Customer scope restriction
  if (req.user.role === 'customer') {
    filter.customer = req.user.customerId;
  } else if (customer) {
    filter.customer = customer;
  }

  if (status) {
    filter.status = status;
  }

  if (search) {
    filter.$or = [{ number: { $regex: search, $options: 'i' } }];
  }

  const [quotations, total] = await Promise.all([
    Quotation.find(filter)
      .populate('customer', 'name email company')
      .populate('plan', 'name billingPeriod price')
      .populate('subscription', 'number status')
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    Quotation.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: quotations,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

exports.getQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id)
    .populate('customer')
    .populate('plan')
    .populate('template')
    .populate('lines.product')
    .populate('lines.variant')
    .populate('lines.tax')
    .populate('subscription')
    .populate('createdBy', 'name email role')
    .lean();

  if (!quotation) {
    throw createError(404, 'Quotation not found');
  }

  if (req.user.role === 'customer' && quotation.customer?._id?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  res.json({
    success: true,
    data: quotation,
  });
});

exports.createQuotation = asyncHandler(async (req, res) => {
  const data = quotationSchema.parse(req.body);

  // Validate customer
  const customer = await Customer.findById(data.customer);
  if (!customer) throw createError(404, 'Customer not found');

  // If template is provided and lines were empty, load template lines
  let lines = data.lines;
  let planId = data.plan;
  let validityDays = data.validityDays || 30;

  if (data.template) {
    const tmpl = await QuotationTemplate.findById(data.template).lean();
    if (tmpl) {
      if (!planId && tmpl.plan) planId = tmpl.plan.toString();
      validityDays = data.validityDays || tmpl.validityDays || 30;
      if (!lines || lines.length === 0) {
        lines = tmpl.lines.map((l) => ({
          product: l.product.toString(),
          variant: l.variant ? l.variant.toString() : null,
          quantity: l.quantity,
        }));
      }
    }
  }

  // Calculate pricing using the single pricing engine
  const pricingResult = await quote({
    lines,
    planId,
    customerId: data.customer,
    asOf: new Date(),
  });

  const number = await nextSequence('QUO');

  const now = new Date();
  let validUntil = data.validUntil ? new Date(data.validUntil) : null;
  if (!validUntil) {
    validUntil = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
  }

  const quotation = await Quotation.create({
    number,
    customer: data.customer,
    template: data.template || undefined,
    plan: planId || undefined,
    lines: pricingResult.lines,
    subtotal: pricingResult.subtotal,
    discountTotal: pricingResult.discountTotal,
    taxTotal: pricingResult.taxTotal,
    total: pricingResult.total,
    validUntil,
    status: 'draft',
    createdBy: req.user.userId,
  });

  // Record initial audit history
  await recordStatusChange({
    entityType: 'quotation',
    entityId: quotation._id,
    from: undefined,
    to: 'draft',
    changedBy: req.user.userId,
    note: `Created quotation ${number}`,
  });

  const populated = await Quotation.findById(quotation._id)
    .populate('customer')
    .populate('plan')
    .populate('lines.product')
    .populate('lines.variant')
    .populate('lines.tax');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

exports.updateQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw createError(404, 'Quotation not found');

  if (quotation.status === 'confirmed') {
    throw createError(400, 'Confirmed quotation cannot be modified');
  }

  const data = quotationSchema.partial().parse(req.body);

  if (data.customer) quotation.customer = data.customer;
  if (data.plan !== undefined) quotation.plan = data.plan || null;
  if (data.template !== undefined) quotation.template = data.template || null;
  if (data.validUntil) quotation.validUntil = new Date(data.validUntil);

  if (data.lines && data.lines.length > 0) {
    // Re-quote with the pricing engine
    const pricingResult = await quote({
      lines: data.lines,
      planId: quotation.plan ? quotation.plan.toString() : undefined,
      customerId: quotation.customer.toString(),
      asOf: new Date(),
    });

    quotation.lines = pricingResult.lines;
    quotation.subtotal = pricingResult.subtotal;
    quotation.discountTotal = pricingResult.discountTotal;
    quotation.taxTotal = pricingResult.taxTotal;
    quotation.total = pricingResult.total;
  }

  await quotation.save();

  const populated = await Quotation.findById(quotation._id)
    .populate('customer')
    .populate('plan')
    .populate('lines.product')
    .populate('lines.variant')
    .populate('lines.tax');

  res.json({
    success: true,
    data: populated,
  });
});

exports.updateQuotationStatus = asyncHandler(async (req, res) => {
  const { status, note } = z.object({
    status: z.enum(['draft', 'quotation', 'confirmed']),
    note: z.string().optional(),
  }).parse(req.body);

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw createError(404, 'Quotation not found');

  if (quotation.status === 'confirmed') {
    throw createError(400, 'Quotation is already confirmed and cannot be transitioned');
  }

  if (status === 'confirmed') {
    if (quotation.validUntil && new Date(quotation.validUntil) < new Date()) {
      throw createError(400, 'Expired quotation cannot be confirmed');
    }
  }

  const prevStatus = quotation.status;
  quotation.status = status;
  await quotation.save();

  await recordStatusChange({
    entityType: 'quotation',
    entityId: quotation._id,
    from: prevStatus,
    to: status,
    changedBy: req.user.userId,
    note: note || `Status updated to ${status}`,
  });

  res.json({
    success: true,
    data: quotation,
  });
});

exports.confirmQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id).populate('plan');
  if (!quotation) throw createError(404, 'Quotation not found');

  if (quotation.status === 'confirmed') {
    throw createError(400, 'Quotation is already confirmed');
  }

  if (quotation.validUntil && new Date(quotation.validUntil) < new Date()) {
    throw createError(400, 'Expired quotation cannot be confirmed');
  }

  if (!quotation.plan) {
    throw createError(400, 'A subscription plan must be assigned before confirming a quotation');
  }

  // Create linked subscription
  const subNumber = await nextSequence('SUB');
  const now = new Date();

  // Expiry date calculation based on plan billing period (default 1 year or cycle)
  let expiryDate = new Date(now);
  const period = quotation.plan.billingPeriod || 'monthly';
  if (period === 'daily') expiryDate.setDate(expiryDate.getDate() + 30);
  else if (period === 'weekly') expiryDate.setDate(expiryDate.getDate() + 90);
  else if (period === 'monthly') expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  else if (period === 'yearly') expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const subscription = await Subscription.create({
    number: subNumber,
    customer: quotation.customer,
    plan: quotation.plan._id,
    quotation: quotation._id,
    startDate: now,
    expiryDate,
    paymentTerms: 'immediate',
    lines: quotation.lines,
    subtotal: quotation.subtotal,
    discountTotal: quotation.discountTotal,
    taxTotal: quotation.taxTotal,
    total: quotation.total,
    status: 'confirmed', // Confirmed, ready for activation
  });

  const prevQuoStatus = quotation.status;
  quotation.status = 'confirmed';
  quotation.subscription = subscription._id;
  await quotation.save();

  // Record audit history for both
  await recordStatusChange({
    entityType: 'quotation',
    entityId: quotation._id,
    from: prevQuoStatus,
    to: 'confirmed',
    changedBy: req.user.userId,
    note: `Confirmed and created subscription ${subNumber}`,
  });

  await recordStatusChange({
    entityType: 'subscription',
    entityId: subscription._id,
    from: undefined,
    to: 'confirmed',
    changedBy: req.user.userId,
    note: `Created from confirmed quotation ${quotation.number}`,
  });

  res.json({
    success: true,
    data: {
      quotation,
      subscription,
    },
  });
});

exports.deleteQuotation = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw createError(404, 'Quotation not found');

  if (quotation.status !== 'draft') {
    throw createError(400, 'Only draft quotations can be deleted');
  }

  await Quotation.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    data: { message: 'Draft quotation deleted successfully' },
  });
});
