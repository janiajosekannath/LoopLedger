const { z } = require('zod');
const Customer = require('../models/Customer');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');

const addressSchema = z.object({
  line1: z.string().optional().default(''),
  line2: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  pincode: z.string().optional().default(''),
  country: z.string().optional().default('India'),
}).optional();

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().default(''),
  company: z.string().optional().default(''),
  address: addressSchema,
});

// Helper for customer-role access scoping
function assertCustomerScope(req, customerId) {
  if (req.user.role === 'customer') {
    if (!req.user.customerId || req.user.customerId.toString() !== customerId.toString()) {
      throw createError(403, 'Access denied: You can only view your own records');
    }
  }
}

// GET /api/customers
exports.listCustomers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, city, state } = req.query;
  const lim = Math.min(parseInt(limit, 10) || 20, 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);

  const filter = {};
  if (search) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { company: { $regex: s, $options: 'i' } },
      { phone: { $regex: s, $options: 'i' } },
    ];
  }
  if (city) {
    filter['address.city'] = { $regex: city.trim(), $options: 'i' };
  }
  if (state) {
    filter['address.state'] = { $regex: state.trim(), $options: 'i' };
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    Customer.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: customers,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

// GET /api/customers/:id
exports.getCustomer = asyncHandler(async (req, res) => {
  assertCustomerScope(req, req.params.id);

  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) throw createError(404, 'Customer not found');

  res.json({
    success: true,
    data: customer,
  });
});

// POST /api/customers
exports.createCustomer = asyncHandler(async (req, res) => {
  const data = customerSchema.parse(req.body);

  const existing = await Customer.findOne({ email: data.email.toLowerCase() });
  if (existing) {
    throw createError(409, 'Customer with this email already exists');
  }

  const customer = await Customer.create({
    ...data,
    email: data.email.toLowerCase(),
  });

  res.status(201).json({
    success: true,
    data: customer,
  });
});

// PUT /api/customers/:id
exports.updateCustomer = asyncHandler(async (req, res) => {
  const data = customerSchema.partial().parse(req.body);

  const customer = await Customer.findById(req.params.id);
  if (!customer) throw createError(404, 'Customer not found');

  if (data.email && data.email.toLowerCase() !== customer.email) {
    const existing = await Customer.findOne({ email: data.email.toLowerCase() });
    if (existing) throw createError(409, 'Email is already used by another customer');
    customer.email = data.email.toLowerCase();
  }

  if (data.name !== undefined) customer.name = data.name;
  if (data.phone !== undefined) customer.phone = data.phone;
  if (data.company !== undefined) customer.company = data.company;
  if (data.address !== undefined) customer.address = { ...customer.address?.toObject(), ...data.address };

  await customer.save();

  res.json({
    success: true,
    data: customer,
  });
});

// DELETE /api/customers/:id (blocked if subscriptions or invoices exist)
exports.deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw createError(404, 'Customer not found');

  const [subCount, invCount] = await Promise.all([
    Subscription.countDocuments({ customer: req.params.id }),
    Invoice.countDocuments({ customer: req.params.id }),
  ]);

  if (subCount > 0) {
    throw createError(400, 'Cannot delete customer with existing subscriptions');
  }
  if (invCount > 0) {
    throw createError(400, 'Cannot delete customer with existing invoices');
  }

  await Customer.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Customer deleted successfully',
  });
});

// GET /api/customers/:id/subscriptions
exports.getCustomerSubscriptions = asyncHandler(async (req, res) => {
  assertCustomerScope(req, req.params.id);

  const customer = await Customer.findById(req.params.id);
  if (!customer) throw createError(404, 'Customer not found');

  const subscriptions = await Subscription.find({ customer: req.params.id })
    .populate('plan')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: subscriptions,
  });
});

// GET /api/customers/:id/invoices
exports.getCustomerInvoices = asyncHandler(async (req, res) => {
  assertCustomerScope(req, req.params.id);

  const customer = await Customer.findById(req.params.id);
  if (!customer) throw createError(404, 'Customer not found');

  const invoices = await Invoice.find({ customer: req.params.id })
    .populate('subscription', 'number')
    .sort({ issueDate: -1 })
    .lean();

  res.json({
    success: true,
    data: invoices,
  });
});

// GET /api/customers/:id/payments
exports.getCustomerPayments = asyncHandler(async (req, res) => {
  assertCustomerScope(req, req.params.id);

  const customer = await Customer.findById(req.params.id);
  if (!customer) throw createError(404, 'Customer not found');

  const payments = await Payment.find({ customer: req.params.id })
    .populate('invoice', 'number total balance')
    .sort({ paidOn: -1 })
    .lean();

  res.json({
    success: true,
    data: payments,
  });
});
