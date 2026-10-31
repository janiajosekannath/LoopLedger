/**
 * controllers/subscriptionController.js
 */

const { z } = require('zod');
const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');
const { nextSequence } = require('../utils/sequence');
const { quote } = require('../services/pricingEngine');
const { recordStatusChange } = require('../services/audit');
const { calculateMrr, recordMrrChange } = require('../services/mrr');

const lineSchema = z.object({
  product: z.string().min(1, 'Product ID is required'),
  variant: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  description: z.string().optional(),
  tax: z.string().optional().nullable(),
});

const subscriptionCreateSchema = z.object({
  customer: z.string().min(1, 'Customer ID is required'),
  plan: z.string().min(1, 'Subscription plan ID is required'),
  startDate: z.string().datetime().or(z.date()).optional(),
  expiryDate: z.string().datetime().or(z.date()).optional(),
  paymentTerms: z.enum(['immediate', 'net15', 'net30', 'net45']).default('immediate'),
  lines: z.array(lineSchema).min(1, 'At least one line item is required'),
});

exports.listSubscriptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status, plan, customer, billingPeriod, from, to } = req.query;
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

  if (plan) {
    filter.plan = plan;
  }

  if (search) {
    filter.number = { $regex: search, $options: 'i' };
  }

  if (from || to) {
    filter.startDate = {};
    if (from) filter.startDate.$gte = new Date(from);
    if (to) filter.startDate.$lte = new Date(to);
  }

  let query = Subscription.find(filter)
    .populate('customer', 'name email company')
    .populate('plan', 'name billingPeriod price allowPause allowEarlyClose allowRenew')
    .skip((pg - 1) * lim)
    .limit(lim)
    .sort({ createdAt: -1 });

  // If billingPeriod filter is specified, join on plan
  let [subscriptions, total] = await Promise.all([
    query.lean(),
    Subscription.countDocuments(filter),
  ]);

  if (billingPeriod) {
    subscriptions = subscriptions.filter(
      (s) => s.plan && s.plan.billingPeriod === billingPeriod
    );
  }

  // Attach normalized MRR to each subscription item
  const data = subscriptions.map((s) => ({
    ...s,
    mrr: calculateMrr(s),
  }));

  res.json({
    success: true,
    data,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

exports.getSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id)
    .populate('customer')
    .populate('plan')
    .populate('quotation', 'number validUntil status')
    .populate('lines.product')
    .populate('lines.variant')
    .populate('lines.tax')
    .lean();

  if (!subscription) {
    throw createError(404, 'Subscription not found');
  }

  if (req.user.role === 'customer' && subscription.customer?._id?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  res.json({
    success: true,
    data: {
      ...subscription,
      mrr: calculateMrr(subscription),
    },
  });
});

exports.createSubscription = asyncHandler(async (req, res) => {
  const data = subscriptionCreateSchema.parse(req.body);

  const customer = await Customer.findById(data.customer);
  if (!customer) throw createError(404, 'Customer not found');

  const plan = await SubscriptionPlan.findById(data.plan);
  if (!plan) throw createError(404, 'Subscription plan not found');

  // Compute pricing
  const pricingResult = await quote({
    lines: data.lines,
    planId: data.plan,
    customerId: data.customer,
    asOf: new Date(),
  });

  const number = await nextSequence('SUB');
  const startDate = data.startDate ? new Date(data.startDate) : new Date();

  let expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  if (!expiryDate) {
    expiryDate = new Date(startDate);
    const period = plan.billingPeriod || 'monthly';
    if (period === 'daily') expiryDate.setDate(expiryDate.getDate() + 30);
    else if (period === 'weekly') expiryDate.setDate(expiryDate.getDate() + 90);
    else if (period === 'monthly') expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    else if (period === 'yearly') expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  }

  const subscription = await Subscription.create({
    number,
    customer: data.customer,
    plan: data.plan,
    startDate,
    expiryDate,
    paymentTerms: data.paymentTerms,
    lines: pricingResult.lines,
    subtotal: pricingResult.subtotal,
    discountTotal: pricingResult.discountTotal,
    taxTotal: pricingResult.taxTotal,
    total: pricingResult.total,
    status: 'confirmed',
  });

  await recordStatusChange({
    entityType: 'subscription',
    entityId: subscription._id,
    from: undefined,
    to: 'confirmed',
    changedBy: req.user.userId,
    note: `Created manual subscription ${number}`,
  });

  const populated = await Subscription.findById(subscription._id)
    .populate('customer')
    .populate('plan')
    .populate('lines.product')
    .populate('lines.variant')
    .populate('lines.tax');

  res.status(201).json({
    success: true,
    data: {
      ...populated.toObject(),
      mrr: calculateMrr(populated),
    },
  });
});

exports.activateSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id).populate('plan');
  if (!subscription) throw createError(404, 'Subscription not found');

  if (subscription.status === 'active') {
    throw createError(400, 'Subscription is already active');
  }
  if (subscription.status === 'closed') {
    throw createError(400, 'Closed subscription cannot be directly activated; use renew');
  }

  const prevStatus = subscription.status;
  subscription.status = 'active';

  // Rule: Activating sets nextBillingDate = startDate
  if (!subscription.nextBillingDate) {
    subscription.nextBillingDate = subscription.startDate || new Date();
  }

  await subscription.save();

  // Record audit history
  await recordStatusChange({
    entityType: 'subscription',
    entityId: subscription._id,
    from: prevStatus,
    to: 'active',
    changedBy: req.user.userId,
    note: 'Subscription activated',
  });

  // Rule: write MrrChange 'new'
  const mrr = calculateMrr(subscription);
  await recordMrrChange({
    subscriptionId: subscription._id,
    type: 'new',
    amount: mrr,
  });

  res.json({
    success: true,
    data: {
      ...subscription.toObject(),
      mrr,
    },
  });
});

exports.pauseSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id).populate('plan');
  if (!subscription) throw createError(404, 'Subscription not found');

  if (req.user.role === 'customer' && subscription.customer?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  if (subscription.status !== 'active') {
    throw createError(400, 'Only active subscriptions can be paused');
  }

  // Rule: Plan flags are enforced on backend for staff AND customers
  if (subscription.plan && subscription.plan.allowPause === false) {
    throw createError(400, 'Plan policy does not permit pausing this subscription');
  }

  const prevStatus = subscription.status;
  subscription.status = 'paused';
  subscription.pausedAt = new Date();
  await subscription.save();

  await recordStatusChange({
    entityType: 'subscription',
    entityId: subscription._id,
    from: prevStatus,
    to: 'paused',
    changedBy: req.user.userId,
    note: req.body.note || 'Subscription paused',
  });

  res.json({
    success: true,
    data: subscription,
  });
});

exports.resumeSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id).populate('plan');
  if (!subscription) throw createError(404, 'Subscription not found');

  if (req.user.role === 'customer' && subscription.customer?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  if (subscription.status !== 'paused') {
    throw createError(400, 'Only paused subscriptions can be resumed');
  }

  const prevStatus = subscription.status;
  subscription.status = 'active';
  subscription.pausedAt = null;
  await subscription.save();

  await recordStatusChange({
    entityType: 'subscription',
    entityId: subscription._id,
    from: prevStatus,
    to: 'active',
    changedBy: req.user.userId,
    note: req.body.note || 'Subscription resumed',
  });

  res.json({
    success: true,
    data: subscription,
  });
});

exports.closeSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id).populate('plan');
  if (!subscription) throw createError(404, 'Subscription not found');

  if (req.user.role === 'customer' && subscription.customer?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  if (subscription.status === 'closed') {
    throw createError(400, 'Subscription is already closed');
  }

  // Rule: Enforce allowEarlyClose plan flag
  const now = new Date();
  const isEarly = subscription.expiryDate && now < new Date(subscription.expiryDate);
  if (isEarly && subscription.plan && subscription.plan.allowEarlyClose === false) {
    throw createError(400, 'Plan policy does not permit early closure before expiry date');
  }

  const prevStatus = subscription.status;
  const mrrBeforeClose = calculateMrr(subscription);

  subscription.status = 'closed';
  subscription.closedAt = now;
  await subscription.save();

  await recordStatusChange({
    entityType: 'subscription',
    entityId: subscription._id,
    from: prevStatus,
    to: 'closed',
    changedBy: req.user.userId,
    note: req.body.note || (isEarly ? 'Early closure' : 'Closed'),
  });

  // Rule: writes MrrChange churn
  if (prevStatus === 'active') {
    await recordMrrChange({
      subscriptionId: subscription._id,
      type: 'churn',
      amount: mrrBeforeClose,
    });
  }

  res.json({
    success: true,
    data: subscription,
  });
});

exports.renewSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id).populate('plan');
  if (!subscription) throw createError(404, 'Subscription not found');

  if (req.user.role === 'customer' && subscription.customer?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  // Rule: Enforce allowRenew plan flag
  if (subscription.plan && subscription.plan.allowRenew === false) {
    throw createError(400, 'Plan policy does not permit renewing this subscription');
  }

  const { extendMonths = 12 } = req.body;
  const baseDate = subscription.expiryDate && new Date(subscription.expiryDate) > new Date()
    ? new Date(subscription.expiryDate)
    : new Date();

  baseDate.setMonth(baseDate.getMonth() + Number(extendMonths));
  subscription.expiryDate = baseDate;

  const prevStatus = subscription.status;
  if (subscription.status === 'closed') {
    subscription.status = 'active';
    subscription.closedAt = null;
    subscription.nextBillingDate = new Date();

    const mrr = calculateMrr(subscription);
    await recordMrrChange({
      subscriptionId: subscription._id,
      type: 'new',
      amount: mrr,
    });
  }

  await subscription.save();

  await recordStatusChange({
    entityType: 'subscription',
    entityId: subscription._id,
    from: prevStatus,
    to: subscription.status,
    changedBy: req.user.userId,
    note: `Renewed subscription until ${baseDate.toISOString().split('T')[0]}`,
  });

  res.json({
    success: true,
    data: {
      ...subscription.toObject(),
      mrr: calculateMrr(subscription),
    },
  });
});
