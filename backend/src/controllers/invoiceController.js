/**
 * controllers/invoiceController.js
 * Invoices management controller: CRUD, lifecycle transitions, PDF streaming, email sending.
 */

const { z } = require('zod');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { createError } = require('../middleware/errorHandler');
const { nextSequence } = require('../utils/sequence');
const { round2 } = require('../utils/money');
const { quote } = require('../services/pricingEngine');
const { recordStatusChange } = require('../services/audit');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { sendMail } = require('../utils/mailer');

const invoiceLineInputSchema = z.object({
  product: z.string().min(1, 'Product ID is required'),
  variant: z.string().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be at least 1').default(1),
  tax: z.string().optional().nullable(),
  description: z.string().optional(),
});

const createInvoiceSchema = z.object({
  customer: z.string().min(1, 'Customer ID is required'),
  subscription: z.string().optional().nullable(),
  lines: z.array(invoiceLineInputSchema).min(1, 'At least one line item is required'),
  issueDate: z.string().datetime().or(z.date()).optional(),
  dueDate: z.string().datetime().or(z.date()).optional(),
  paymentTermsDays: z.number().int().min(0).default(15),
});

/**
 * List invoices with filters and customer scoping.
 * GET /api/invoices
 */
exports.listInvoices = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    customer,
    subscription,
    overdue,
    issueDateFrom,
    issueDateTo,
    dueDateFrom,
    dueDateTo,
  } = req.query;

  const lim = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const pg = Math.max(1, parseInt(page) || 1);

  const filter = {};

  // Strict customer role isolation
  if (req.user.role === 'customer') {
    filter.customer = req.user.customerId;
  } else if (customer) {
    filter.customer = customer;
  }

  if (subscription) filter.subscription = subscription;
  if (status) filter.status = status;

  if (overdue === 'true') {
    filter.status = { $in: ['confirmed', 'draft'] };
    filter.balance = { $gt: 0 };
    filter.dueDate = { $lt: new Date() };
  }

  if (issueDateFrom || issueDateTo) {
    filter.issueDate = {};
    if (issueDateFrom) filter.issueDate.$gte = new Date(issueDateFrom);
    if (issueDateTo) filter.issueDate.$lte = new Date(issueDateTo);
  }

  if (dueDateFrom || dueDateTo) {
    filter.dueDate = {};
    if (dueDateFrom) filter.dueDate.$gte = new Date(dueDateFrom);
    if (dueDateTo) filter.dueDate.$lte = new Date(dueDateTo);
  }

  if (search) {
    filter.$or = [{ number: { $regex: search, $options: 'i' } }];
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('customer', 'name email company phone address')
      .populate('subscription', 'number plan')
      .skip((pg - 1) * lim)
      .limit(lim)
      .sort({ createdAt: -1 })
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  // Compute overdue flag dynamically
  const now = new Date();
  const enrichedInvoices = invoices.map((inv) => ({
    ...inv,
    isOverdue: inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate && new Date(inv.dueDate) < now && (inv.balance || 0) > 0,
  }));

  res.json({
    success: true,
    data: enrichedInvoices,
    meta: {
      page: pg,
      limit: lim,
      total,
      totalPages: Math.ceil(total / lim),
    },
  });
});

/**
 * Get invoice detail.
 * GET /api/invoices/:id
 */
exports.getInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('customer')
    .populate('subscription')
    .populate('lines.product', 'name type salesPrice')
    .populate('lines.variant', 'attribute value extraPrice')
    .populate('lines.tax', 'name percent')
    .populate('appliedDiscounts.discount', 'name type value')
    .lean();

  if (!invoice) throw createError(404, 'Invoice not found');

  if (req.user.role === 'customer' && invoice.customer?._id?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  const now = new Date();
  const isOverdue =
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled' &&
    invoice.dueDate &&
    new Date(invoice.dueDate) < now &&
    (invoice.balance || 0) > 0;

  res.json({
    success: true,
    data: {
      ...invoice,
      isOverdue,
    },
  });
});

/**
 * Create manual invoice (Admin/Staff only).
 * POST /api/invoices
 */
exports.createInvoice = asyncHandler(async (req, res) => {
  const data = createInvoiceSchema.parse(req.body);

  const customer = await Customer.findById(data.customer);
  if (!customer) throw createError(404, 'Customer not found');

  const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
  const dueDate = data.dueDate
    ? new Date(data.dueDate)
    : new Date(issueDate.getTime() + (data.paymentTermsDays || 15) * 86400000);

  // Price lines via central engine
  const priced = await quote({
    lines: data.lines,
    customerId: customer._id,
    subscriptionId: data.subscription,
    asOf: issueDate,
  });

  const number = await nextSequence('INV');

  const invoice = await Invoice.create({
    number,
    customer: customer._id,
    subscription: data.subscription || undefined,
    issueDate,
    dueDate,
    lines: priced.lines,
    subtotal: priced.subtotal,
    discountTotal: priced.discountTotal,
    taxTotal: priced.taxTotal,
    total: priced.total,
    amountPaid: 0,
    balance: priced.total,
    status: 'draft',
    appliedDiscounts: priced.appliedDiscounts,
  });

  await recordStatusChange({
    entityType: 'invoice',
    entityId: invoice._id,
    from: null,
    to: 'draft',
    changedBy: req.user.userId,
    note: `Invoice ${number} created manually in draft status`,
  });

  res.status(201).json({
    success: true,
    data: invoice,
  });
});

/**
 * Confirm invoice.
 * PATCH /api/invoices/:id/confirm
 */
exports.confirmInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw createError(404, 'Invoice not found');

  if (invoice.status !== 'draft') {
    throw createError(400, `Cannot confirm an invoice in '${invoice.status}' status`);
  }

  const prevStatus = invoice.status;
  invoice.status = 'confirmed';
  await invoice.save();

  await recordStatusChange({
    entityType: 'invoice',
    entityId: invoice._id,
    from: prevStatus,
    to: 'confirmed',
    changedBy: req.user.userId,
    note: `Invoice ${invoice.number} confirmed`,
  });

  res.json({
    success: true,
    data: invoice,
  });
});

/**
 * Cancel invoice.
 * PATCH /api/invoices/:id/cancel
 */
exports.cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw createError(404, 'Invoice not found');

  if (invoice.amountPaid > 0) {
    throw createError(400, 'Cannot cancel an invoice with recorded payments');
  }

  if (invoice.status === 'cancelled') {
    throw createError(400, 'Invoice is already cancelled');
  }

  const prevStatus = invoice.status;
  invoice.status = 'cancelled';
  await invoice.save();

  await recordStatusChange({
    entityType: 'invoice',
    entityId: invoice._id,
    from: prevStatus,
    to: 'cancelled',
    changedBy: req.user.userId,
    note: `Invoice ${invoice.number} cancelled`,
  });

  res.json({
    success: true,
    data: invoice,
  });
});

/**
 * Send invoice PDF via email.
 * POST /api/invoices/:id/send
 */
exports.sendInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('customer')
    .populate('lines.product')
    .populate('lines.variant');

  if (!invoice) throw createError(404, 'Invoice not found');

  if (!invoice.customer?.email) {
    throw createError(400, 'Customer does not have a valid email address');
  }

  const pdfBuffer = await generateInvoicePDF(invoice);

  const emailResult = await sendMail({
    to: invoice.customer.email,
    subject: `Your Invoice ${invoice.number} from Brightloop`,
    html: `
      <p>Dear ${invoice.customer.name || invoice.customer.company || 'Customer'},</p>
      <p>Please find attached your invoice <strong>${invoice.number}</strong> for ₹${invoice.total.toFixed(2)}.</p>
      <p>Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'Upon receipt'}</p>
      <p>Thank you for your business!</p>
    `,
    text: `Invoice ${invoice.number} attached. Total: ₹${invoice.total.toFixed(2)}.`,
    attachments: [
      {
        filename: `${invoice.number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  invoice.sentAt = new Date();
  if (invoice.status === 'draft') {
    invoice.status = 'confirmed';
  }
  await invoice.save();

  res.json({
    success: true,
    data: {
      sent: true,
      sentAt: invoice.sentAt,
      messageId: emailResult?.messageId,
      previewUrl: emailResult?.previewUrl,
    },
  });
});

/**
 * Stream/download invoice PDF.
 * GET /api/invoices/:id/pdf
 */
exports.downloadInvoicePDF = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('customer')
    .populate('lines.product')
    .populate('lines.variant');

  if (!invoice) throw createError(404, 'Invoice not found');

  if (req.user.role === 'customer' && invoice.customer?._id?.toString() !== req.user.customerId) {
    throw createError(403, 'Forbidden');
  }

  const pdfBuffer = await generateInvoicePDF(invoice);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${invoice.number || 'invoice'}.pdf"`
  );
  res.send(pdfBuffer);
});
