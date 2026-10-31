const { z } = require('zod');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { Product } = require('../models/Product');
const Subscription = require('../models/Subscription');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');

const basePlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  product: z.string().min(1, 'Product reference is required'),
  price: z.number().min(0, 'Plan price must be >= 0'),
  billingPeriod: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  minQty: z.number().min(1, 'Minimum quantity must be at least 1').default(1),
  availableFrom: z.string().optional().nullable(),
  availableTo: z.string().optional().nullable(),
  autoClose: z.boolean().optional().default(false),
  allowEarlyClose: z.boolean().optional().default(true),
  allowPause: z.boolean().optional().default(true),
  allowRenew: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
});

const planSchema = basePlanSchema.refine(
  (data) => {
    if (data.availableFrom && data.availableTo) {
      return new Date(data.availableTo) >= new Date(data.availableFrom);
    }
    return true;
  },
  {
    message: 'availableTo must be after availableFrom',
    path: ['availableTo'],
  }
);

// GET /api/plans
exports.listPlans = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, product, billingPeriod, active, availableAsOf } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (active !== undefined) {
    filter.active = active === 'true' || active === true;
  }
  if (product) {
    filter.product = product;
  }
  if (billingPeriod) {
    filter.billingPeriod = billingPeriod;
  }
  if (search) {
    filter.name = { $regex: search.trim(), $options: 'i' };
  }

  // Filter plans available as of a specific date
  if (availableAsOf) {
    const asOfDate = new Date(availableAsOf);
    filter.$and = [
      {
        $or: [
          { availableFrom: null },
          { availableFrom: { $exists: false } },
          { availableFrom: { $lte: asOfDate } },
        ],
      },
      {
        $or: [
          { availableTo: null },
          { availableTo: { $exists: false } },
          { availableTo: { $gte: asOfDate } },
        ],
      },
    ];
  }

  const [plans, total] = await Promise.all([
    SubscriptionPlan.find(filter)
      .populate('product')
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    SubscriptionPlan.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: plans,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

// GET /api/plans/:id
exports.getPlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id).populate('product').lean();
  if (!plan) throw createError(404, 'Subscription plan not found');

  res.json({
    success: true,
    data: plan,
  });
});

// POST /api/plans
exports.createPlan = asyncHandler(async (req, res) => {
  const data = planSchema.parse(req.body);

  const productExists = await Product.findById(data.product);
  if (!productExists) throw createError(404, 'Referenced product not found');

  const plan = await SubscriptionPlan.create({
    ...data,
    availableFrom: data.availableFrom ? new Date(data.availableFrom) : undefined,
    availableTo: data.availableTo ? new Date(data.availableTo) : undefined,
  });

  const populated = await SubscriptionPlan.findById(plan._id).populate('product').lean();

  res.status(201).json({
    success: true,
    data: populated,
  });
});

// PUT /api/plans/:id
exports.updatePlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) throw createError(404, 'Subscription plan not found');

  const data = basePlanSchema.partial().parse(req.body);

  // Validate dates if either is updated
  const from = data.availableFrom !== undefined ? data.availableFrom : plan.availableFrom;
  const to = data.availableTo !== undefined ? data.availableTo : plan.availableTo;
  if (from && to && new Date(to) < new Date(from)) {
    throw createError(400, 'availableTo must be after availableFrom');
  }

  if (data.name !== undefined) plan.name = data.name;
  if (data.product !== undefined) plan.product = data.product;
  if (data.price !== undefined) plan.price = data.price;
  if (data.billingPeriod !== undefined) plan.billingPeriod = data.billingPeriod;
  if (data.minQty !== undefined) plan.minQty = data.minQty;
  if (data.availableFrom !== undefined) plan.availableFrom = data.availableFrom ? new Date(data.availableFrom) : null;
  if (data.availableTo !== undefined) plan.availableTo = data.availableTo ? new Date(data.availableTo) : null;
  if (data.autoClose !== undefined) plan.autoClose = data.autoClose;
  if (data.allowEarlyClose !== undefined) plan.allowEarlyClose = data.allowEarlyClose;
  if (data.allowPause !== undefined) plan.allowPause = data.allowPause;
  if (data.allowRenew !== undefined) plan.allowRenew = data.allowRenew;
  if (data.active !== undefined) plan.active = data.active;

  await plan.save();

  const populated = await SubscriptionPlan.findById(plan._id).populate('product').lean();

  res.json({
    success: true,
    data: populated,
  });
});

// PATCH /api/plans/:id/toggle
exports.togglePlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) throw createError(404, 'Subscription plan not found');

  plan.active = !plan.active;
  await plan.save();

  res.json({
    success: true,
    data: plan,
  });
});

// DELETE /api/plans/:id
exports.deletePlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) throw createError(404, 'Subscription plan not found');

  const activeSubCount = await Subscription.countDocuments({
    plan: req.params.id,
    status: { $in: ['active', 'paused'] },
  });
  if (activeSubCount > 0) {
    throw createError(400, 'Cannot delete a plan currently used by active subscriptions');
  }

  await SubscriptionPlan.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Subscription plan deleted successfully',
  });
});
