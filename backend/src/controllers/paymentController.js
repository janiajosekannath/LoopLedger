/**
 * controllers/paymentController.js
 */

const { z } = require('zod');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');
const { nextSequence } = require('../utils/sequence');
const { round2 } = require('../utils/money');
const { recordStatusChange } = require('../services/audit');

const paymentSchema = z.object({
  invoice: z.string().min(1, 'Invoice ID is required'),
  method: z.enum(['cash', 'bank_transfer', 'card', 'upi', 'other']),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paidOn: z.string().datetime().or(z.date()).optional(),
  note: z.string().optional(),
});

exports.createPayment = asyncHandler(async (req, res) => {
  const data = paymentSchema.parse(req.body);

  const invoice = await Invoice.findById(data.invoice);
  if (!invoice) throw createError(404, 'Invoice not found');

  if (invoice.status === 'cancelled') {
    throw createError(400, 'Cannot record payment on a cancelled invoice');
  }

  const paymentAmount = round2(data.amount);
  const currentBalance = round2(invoice.balance != null ? invoice.balance : invoice.total - (invoice.amountPaid || 0));

  if (paymentAmount > currentBalance) {
    throw createError(
      400,
      `Payment amount (₹${paymentAmount}) cannot exceed invoice balance (₹${currentBalance})`
    );
  }

  const number = await nextSequence('PAY');
  const paidOn = data.paidOn ? new Date(data.paidOn) : new Date();

  const payment = await Payment.create({
    number,
    customer: invoice.customer,
    invoice: invoice._id,
    method: data.method,
    amount: paymentAmount,
    paidOn,
    note: data.note,
    recordedBy: req.user.userId,
  });

  // Update invoice amountPaid and balance atomically
  const newAmountPaid = round2((invoice.amountPaid || 0) + paymentAmount);
  const newBalance = round2(invoice.total - newAmountPaid);

  const prevInvStatus = invoice.status;
  invoice.amountPaid = newAmountPaid;
  invoice.balance = Math.max(0, newBalance);

  if (newBalance <= 0) {
    invoice.status = 'paid';
  } else if (invoice.status === 'draft') {
    invoice.status = 'confirmed';
  }

  await invoice.save();

  if (invoice.status !== prevInvStatus) {
    await recordStatusChange({
      entityType: 'invoice',
      entityId: invoice._id,
      from: prevInvStatus,
      to: invoice.status,
      changedBy: req.user.userId,
      note: `Status changed to ${invoice.status} after payment ${number} of ₹${paymentAmount}`,
    });
  }

  res.status(201).json({
    success: true,
    data: {
      payment,
      invoice: {
        _id: invoice._id,
        number: invoice.number,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        balance: invoice.balance,
        status: invoice.status,
      },
    },
  });
});

exports.listPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, customer, invoice, method } = req.query;
  const lim = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const pg = Math.max(1, parseInt(page) || 1);

  const filter = {};

  if (req.user.role === 'customer') {
    filter.customer = req.user.customerId;
  } else if (customer) {
    filter.customer = customer;
  }

  if (invoice) {
    filter.invoice = invoice;
  }

  if (method) {
    filter.method = method;
  }

  if (search) {
    filter.$or = [
      { number: { $regex: search, $options: 'i' } },
      { note: { $regex: search, $options: 'i' } },
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
