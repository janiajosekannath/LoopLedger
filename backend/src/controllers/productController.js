const { z } = require('zod');
const { Product, ProductVariant } = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');

const variantItemSchema = z.object({
  attribute: z.string().min(1, 'Attribute name is required'),
  value: z.string().min(1, 'Attribute value is required'),
  extraPrice: z.number().default(0),
});

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  type: z.enum(['service', 'physical', 'digital', 'subscription']).default('service'),
  salesPrice: z.number().min(0, 'Sales price must be >= 0'),
  costPrice: z.number().min(0, 'Cost price must be >= 0').optional().default(0),
  notes: z.string().optional().default(''),
  tax: z.string().optional().nullable(),
  archived: z.boolean().optional().default(false),
  variants: z.array(variantItemSchema).optional().default([]),
});

// GET /api/products
exports.listProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, type, includeArchived } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (includeArchived !== 'true') {
    filter.archived = false;
  }
  if (type) {
    filter.type = type;
  }
  if (search) {
    filter.name = { $regex: search.trim(), $options: 'i' };
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('tax')
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    Product.countDocuments(filter),
  ]);

  // Attach variants to each product
  const productIds = products.map((p) => p._id);
  const variants = await ProductVariant.find({ product: { $in: productIds } }).lean();

  const variantMap = {};
  for (const v of variants) {
    const pId = v.product.toString();
    if (!variantMap[pId]) variantMap[pId] = [];
    variantMap[pId].push(v);
  }

  const data = products.map((p) => ({
    ...p,
    variants: variantMap[p._id.toString()] || [],
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

// GET /api/products/:id
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('tax').lean();
  if (!product) throw createError(404, 'Product not found');

  const variants = await ProductVariant.find({ product: product._id }).lean();

  res.json({
    success: true,
    data: {
      ...product,
      variants,
    },
  });
});

// POST /api/products
exports.createProduct = asyncHandler(async (req, res) => {
  const data = productSchema.parse(req.body);
  const { variants, ...prodData } = data;

  const product = await Product.create({
    ...prodData,
    tax: prodData.tax ? prodData.tax : undefined,
  });

  const createdVariants = [];
  if (variants && variants.length > 0) {
    for (const v of variants) {
      const variant = await ProductVariant.create({
        product: product._id,
        attribute: v.attribute.trim(),
        value: v.value.trim(),
        extraPrice: Number(v.extraPrice) || 0,
      });
      createdVariants.push(variant);
    }
  }

  const populated = await Product.findById(product._id).populate('tax').lean();

  res.status(201).json({
    success: true,
    data: {
      ...populated,
      variants: createdVariants,
    },
  });
});

// PUT /api/products/:id
exports.updateProduct = asyncHandler(async (req, res) => {
  const data = productSchema.partial().parse(req.body);
  const product = await Product.findById(req.params.id);
  if (!product) throw createError(404, 'Product not found');

  if (data.name !== undefined) product.name = data.name;
  if (data.type !== undefined) product.type = data.type;
  if (data.salesPrice !== undefined) product.salesPrice = data.salesPrice;
  if (data.costPrice !== undefined) product.costPrice = data.costPrice;
  if (data.notes !== undefined) product.notes = data.notes;
  if (data.tax !== undefined) product.tax = data.tax ? data.tax : null;
  if (data.archived !== undefined) product.archived = data.archived;

  await product.save();

  const populated = await Product.findById(product._id).populate('tax').lean();
  const variants = await ProductVariant.find({ product: product._id }).lean();

  res.json({
    success: true,
    data: {
      ...populated,
      variants,
    },
  });
});

// DELETE /api/products/:id (archives or deletes)
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw createError(404, 'Product not found');

  // Archive product
  product.archived = true;
  await product.save();

  res.json({
    success: true,
    message: 'Product archived successfully',
  });
});

// POST /api/products/:id/variants
exports.addVariant = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw createError(404, 'Product not found');

  const data = variantItemSchema.parse(req.body);

  const existing = await ProductVariant.findOne({
    product: product._id,
    attribute: data.attribute.trim(),
    value: data.value.trim(),
  });
  if (existing) {
    throw createError(409, 'A variant with this attribute and value already exists for this product');
  }

  const variant = await ProductVariant.create({
    product: product._id,
    attribute: data.attribute.trim(),
    value: data.value.trim(),
    extraPrice: Number(data.extraPrice) || 0,
  });

  res.status(201).json({
    success: true,
    data: variant,
  });
});

// PUT /api/products/:id/variants/:variantId
exports.updateVariant = asyncHandler(async (req, res) => {
  const variant = await ProductVariant.findOne({
    _id: req.params.variantId,
    product: req.params.id,
  });
  if (!variant) throw createError(404, 'Product variant not found');

  const data = variantItemSchema.partial().parse(req.body);

  if (data.attribute !== undefined) variant.attribute = data.attribute.trim();
  if (data.value !== undefined) variant.value = data.value.trim();
  if (data.extraPrice !== undefined) variant.extraPrice = Number(data.extraPrice) || 0;

  await variant.save();

  res.json({
    success: true,
    data: variant,
  });
});

// DELETE /api/products/:id/variants/:variantId
exports.deleteVariant = asyncHandler(async (req, res) => {
  const variant = await ProductVariant.findOneAndDelete({
    _id: req.params.variantId,
    product: req.params.id,
  });
  if (!variant) throw createError(404, 'Product variant not found');

  res.json({
    success: true,
    message: 'Variant deleted successfully',
  });
});
