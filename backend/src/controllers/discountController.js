const { z } = require('zod');
const Discount = require('../models/Discount');
const { getDiscountStatus } = require('../services/discountEligibility');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');

const baseDiscountSchema = z.object({
  name: z.string().min(1, 'Discount name is required'),
  type: z.enum(['fixed', 'percent']),
  value: z.number().min(0, 'Discount value must be >= 0'),
  minPurchase: z.number().min(0).optional().default(0),
  minQty: z.number().min(0).optional().default(0),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  usageLimit: z.number().optional().nullable(),
  scope: z.enum(['product', 'subscription']),
  products: z.array(z.string()).optional().default([]),
  subscriptions: z.array(z.string()).optional().default([]),
  active: z.boolean().optional().default(true),
});

const discountSchema = baseDiscountSchema
  .refine(
    (data) => {
      if (data.type === 'percent' && data.value > 100) {
        return false;
      }
      return true;
    },
    {
      message: 'Percent discount value cannot exceed 100',
      path: ['value'],
    }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'endDate must be after startDate',
      path: ['endDate'],
    }
  );

// GET /api/discounts
exports.listDiscounts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, scope, type, active, status } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (scope) filter.scope = scope;
  if (type) filter.type = type;
  if (active !== undefined) filter.active = active === 'true' || active === true;
  if (search) {
    filter.name = { $regex: search.trim(), $options: 'i' };
  }

  const [discounts, total] = await Promise.all([
    Discount.find(filter)
      .populate('products', 'name salesPrice')
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    Discount.countDocuments(filter),
  ]);

  const now = new Date();
  const data = discounts.map((d) => ({
    ...d,
    computedStatus: getDiscountStatus(d, now),
  }));

  // Filter by computed status if requested
  const filteredData = status
    ? data.filter((d) => d.computedStatus === status)
    : data;

  res.json({
    success: true,
    data: filteredData,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

// GET /api/discounts/:id
exports.getDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id)
    .populate('products', 'name salesPrice')
    .lean();
  if (!discount) throw createError(404, 'Discount rule not found');

  res.json({
    success: true,
    data: {
      ...discount,
      computedStatus: getDiscountStatus(discount, new Date()),
    },
  });
});

// POST /api/discounts (admin only)
exports.createDiscount = asyncHandler(async (req, res) => {
  const data = discountSchema.parse(req.body);

  const discount = await Discount.create({
    ...data,
    startDate: data.startDate ? new Date(data.startDate) : undefined,
    endDate: data.endDate ? new Date(data.endDate) : undefined,
    timesUsed: 0,
  });

  const populated = await Discount.findById(discount._id).populate('products', 'name salesPrice').lean();

  res.status(201).json({
    success: true,
    data: {
      ...populated,
      computedStatus: getDiscountStatus(populated, new Date()),
    },
  });
});

// PUT /api/discounts/:id (admin only)
exports.updateDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  if (!discount) throw createError(404, 'Discount rule not found');

  const data = baseDiscountSchema.partial().parse(req.body);

  // Validate dates
  const start = data.startDate !== undefined ? data.startDate : discount.startDate;
  const end = data.endDate !== undefined ? data.endDate : discount.endDate;
  if (start && end && new Date(end) < new Date(start)) {
    throw createError(400, 'endDate must be after startDate');
  }

  // Validate usage limit cannot be lower than timesUsed
  if (data.usageLimit !== undefined && data.usageLimit !== null) {
    if (data.usageLimit < discount.timesUsed) {
      throw createError(400, `usageLimit (${data.usageLimit}) cannot be lower than timesUsed (${discount.timesUsed})`);
    }
  }

  if (data.type === 'percent' && data.value != null && data.value > 100) {
    throw createError(400, 'Percent discount value cannot exceed 100');
  }

  if (data.name !== undefined) discount.name = data.name;
  if (data.type !== undefined) discount.type = data.type;
  if (data.value !== undefined) discount.value = data.value;
  if (data.minPurchase !== undefined) discount.minPurchase = data.minPurchase;
  if (data.minQty !== undefined) discount.minQty = data.minQty;
  if (data.startDate !== undefined) discount.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) discount.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.usageLimit !== undefined) discount.usageLimit = data.usageLimit;
  if (data.scope !== undefined) discount.scope = data.scope;
  if (data.products !== undefined) discount.products = data.products;
  if (data.subscriptions !== undefined) discount.subscriptions = data.subscriptions;
  if (data.active !== undefined) discount.active = data.active;

  await discount.save();

  const populated = await Discount.findById(discount._id).populate('products', 'name salesPrice').lean();

  res.json({
    success: true,
    data: {
      ...populated,
      computedStatus: getDiscountStatus(populated, new Date()),
    },
  });
});

// PATCH /api/discounts/:id/toggle (admin only)
exports.toggleDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  if (!discount) throw createError(404, 'Discount rule not found');

  discount.active = !discount.active;
  await discount.save();

  res.json({
    success: true,
    data: {
      ...discount.toObject(),
      computedStatus: getDiscountStatus(discount, new Date()),
    },
  });
});

// DELETE /api/discounts/:id (admin only)
exports.deleteDiscount = asyncHandler(async (req, res) => {
  const discount = await Discount.findById(req.params.id);
  if (!discount) throw createError(404, 'Discount rule not found');

  if (discount.timesUsed > 0) {
    // If already used, archive / set inactive instead of hard deleting to preserve historical integrity
    discount.active = false;
    await discount.save();
    return res.json({
      success: true,
      message: 'Discount has previous usage records; marked inactive instead of hard deleting',
    });
  }

  await Discount.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Discount deleted successfully',
  });
});
