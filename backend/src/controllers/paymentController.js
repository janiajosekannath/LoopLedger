/**
 * controllers/paymentController.js
 */

const { z } = require('zod');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');
const paymentProcessor = require('../services/paymentProcessor');

const payInvoiceSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than 0'),
  method: z.enum(['cash', 'bank_transfer', 'card', 'upi', 'other']).default('card'),
  paidOn: z.string().datetime().or(z.date()).optional(),
  note: z.string().optional(),
  transactionId: z.string().optional(),
  cardDetails: z
    .object({
      cardNumber: z.string().optional(),
      expiryMonth: z.string().optional(),
      expiryYear: z.string().optional(),
      cvv: z.string().optional(),
    })
    .optional(),
  upiId: z.string().optional(),
});

const legacyPaymentSchema = z.object({
  invoice: z.string().min(1, 'Invoice ID is required'),
  method: z.enum(['cash', 'bank_transfer', 'card', 'upi', 'other']),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paidOn: z.string().datetime().or(z.date()).optional(),
  note: z.string().optional(),
  transactionId: z.string().optional(),
});

const refundSchema = z.object({
  reason: z.string().min(3, 'Refund reason must be at least 3 characters').optional(),
});

/**
 * Record payment (general endpoint).
 */
exports.createPayment = asyncHandler(async (req, res) => {
  const data = legacyPaymentSchema.parse(req.body);

  const result = await paymentProcessor.processPayment({
    invoiceId: data.invoice,
    amount: data.amount,
    method: data.method,
    paidOn: data.paidOn,
    note: data.note,
    transactionId: data.transactionId,
    recordedBy: req.user.userId,
  });

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * Pay a specific invoice (accessible by Admin, Staff, and Customer for their own invoice).
 * POST /api/payments/:invoiceId/pay
 */
exports.payInvoice = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const data = payInvoiceSchema.parse(req.body);

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw createError(404, 'Invoice not found');

  // Customer scoping check
  if (req.user.role === 'customer') {
    if (!invoice.customer || invoice.customer.toString() !== req.user.customerId) {
      throw createError(403, 'You do not have permission to pay this invoice');
    }
  }

  const result = await paymentProcessor.processPayment({
    invoiceId: invoice._id,
    amount: data.amount,
    method: data.method,
    paidOn: data.paidOn,
    note: data.note || (req.user.role === 'customer' ? 'Customer portal online payment' : undefined),
    transactionId: data.transactionId,
    recordedBy: req.user.userId,
    gatewayResponse: {
      cardDetails: data.cardDetails ? { last4: data.cardDetails.cardNumber?.slice(-4) } : undefined,
      upiId: data.upiId,
    },
  });

  res.status(201).json({
    success: true,
    data: result,
  });
});

/**
 * Refund a payment.
 * PATCH /api/payments/:id/refund
 */
exports.refundPayment = asyncHandler(async (req, res) => {
  const data = refundSchema.parse(req.body || {});

  const result = await paymentProcessor.processRefund({
    paymentId: req.params.id,
    reason: data.reason || 'Customer refund requested',
    refundedBy: req.user.userId,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Mock Gateway Webhook.
 * POST /api/payments/webhook
 */
exports.handleWebhook = asyncHandler(async (req, res) => {
  const event = req.body.event;
  const payload = req.body.payload;
  const signature = req.headers['x-mock-signature'] || req.body.signature;

  const result = await paymentProcessor.handleWebhook({
    event,
    payload,
    signature,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * List payments.
 */
exports.listPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, customer, invoice, method, status } = req.query;
  const lim = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const pg = Math.max(1, parseInt(page) || 1);

  const filter = {};

  if (req.user.role === 'customer') {
    filter.customer = req.user.customerId;
  } else if (customer) {
    filter.customer = customer;
  }

  if (invoice) filter.invoice = invoice;
  if (method) filter.method = method;
  if (status) filter.status = status;

  if (search) {
    filter.$or = [
      { number: { $regex: search, $options: 'i' } },
      { note: { $regex: search, $options: 'i' } },
      { transactionId: { $regex: search, $options: 'i' } },
    ];
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('customer', 'name email company')
      .populate('invoice', 'number total balance status')
      .populate('recordedBy', 'name email')
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ paidOn: -1 })
      .lean(),
    Payment.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: payments,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

/**
 * Get payment by ID.
 */
exports.getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('customer')
    .populate('invoice')
    .populate('recordedBy', 'name email role')
    .lean();

  if (!payment) throw createError(404, 'Payment not found');

  if (req.user.role === 'customer' && payment.customer?._id?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  res.json({
    success: true,
    data: payment,
  });
});
