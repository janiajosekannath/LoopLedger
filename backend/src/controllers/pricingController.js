/**
 * controllers/pricingController.js
 */

const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { quote } = require('../services/pricingEngine');

const lineSchema = z.object({
  product: z.string().min(1, 'Product ID is required'),
  variant: z.string().optional().nullable(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1),
  description: z.string().optional(),
  tax: z.string().optional().nullable(),
});

const quoteSchema = z.object({
  lines: z.array(lineSchema).min(1, 'At least one line item is required'),
  planId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  subscriptionId: z.string().optional().nullable(),
  asOf: z.string().datetime().or(z.date()).optional(),
});

exports.calculateQuote = asyncHandler(async (req, res) => {
  const validated = quoteSchema.parse(req.body);

  const result = await quote({
    lines: validated.lines,
    planId: validated.planId,
    customerId: validated.customerId,
    subscriptionId: validated.subscriptionId,
    asOf: validated.asOf ? new Date(validated.asOf) : new Date(),
  });

  res.json({
    success: true,
    data: result,
  });
});
