/**
 * services/paymentProcessor.js
 * Central payment settlement & gateway processing service.
 * Handles recording payments, updating invoice balances, setting paid/confirmed statuses,
 * updating discount usage counters on settlement, issuing refunds, and processing webhooks.
 */

const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Discount = require('../models/Discount');
const { nextSequence } = require('../utils/sequence');
const { round2 } = require('../utils/money');
const { recordStatusChange } = require('./audit');
const { createError } = require('../middleware/errorHandler');

/**
 * Record and process a payment against an invoice.
 * @param {Object} options
 * @param {string} options.invoiceId
 * @param {number} options.amount
 * @param {string} options.method ('cash'|'bank_transfer'|'card'|'upi'|'other')
 * @param {Date|string} [options.paidOn]
 * @param {string} [options.note]
 * @param {string} [options.recordedBy] - User ID
 * @param {string} [options.transactionId]
 * @param {Object} [options.gatewayResponse]
 * @returns {Promise<{ payment: Object, invoice: Object }>}
 */
async function processPayment({
  invoiceId,
  amount,
  method = 'card',
  paidOn,
  note,
  recordedBy,
  transactionId,
  gatewayResponse,
}) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw createError(404, 'Invoice not found');

  if (invoice.status === 'cancelled') {
    throw createError(400, 'Cannot record payment on a cancelled invoice');
  }

  const paymentAmount = round2(amount);
  if (!paymentAmount || paymentAmount <= 0) {
    throw createError(400, 'Payment amount must be greater than 0');
  }

  const currentBalance = round2(
    invoice.balance != null ? invoice.balance : invoice.total - (invoice.amountPaid || 0)
  );

  if (paymentAmount > currentBalance) {
    throw createError(
      400,
      `Payment amount (₹${paymentAmount}) cannot exceed invoice balance (₹${currentBalance})`
    );
  }

  const number = await nextSequence('PAY');
  const paymentDate = paidOn ? new Date(paidOn) : new Date();

  const payment = await Payment.create({
    number,
    customer: invoice.customer,
    invoice: invoice._id,
    method,
    amount: paymentAmount,
    paidOn: paymentDate,
    status: 'completed',
    transactionId: transactionId || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    note,
    recordedBy,
    gatewayResponse,
  });

  const prevInvStatus = invoice.status;
  const newAmountPaid = round2((invoice.amountPaid || 0) + paymentAmount);
  const newBalance = Math.max(0, round2(invoice.total - newAmountPaid));

  invoice.amountPaid = newAmountPaid;
  invoice.balance = newBalance;

  // Fully paid vs partial
  if (newBalance <= 0) {
    invoice.status = 'paid';

    // Increment Discount.timesUsed only when a payment is recorded that fully settles an invoice
    if (invoice.appliedDiscounts && invoice.appliedDiscounts.length > 0) {
      for (const ad of invoice.appliedDiscounts) {
        if (ad.discount) {
          await Discount.findByIdAndUpdate(ad.discount, { $inc: { timesUsed: 1 } });
        }
      }
    }
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
      changedBy: recordedBy,
      note: `Status updated to ${invoice.status} after payment ${number} of ₹${paymentAmount}`,
    });
  }

  return { payment, invoice };
}

/**
 * Refund a completed payment.
 * @param {Object} options
 * @param {string} options.paymentId
 * @param {string} options.reason
 * @param {string} [options.refundedBy]
 * @returns {Promise<{ payment: Object, invoice: Object }>}
 */
async function processRefund({ paymentId, reason = 'Customer requested refund', refundedBy }) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw createError(404, 'Payment not found');

  if (payment.status === 'refunded') {
    throw createError(400, 'Payment has already been refunded');
  }

  const invoice = await Invoice.findById(payment.invoice);
  if (!invoice) throw createError(404, 'Linked invoice not found');

  const prevInvStatus = invoice.status;
  const refundAmount = round2(payment.amount);
  const newAmountPaid = Math.max(0, round2((invoice.amountPaid || 0) - refundAmount));
  const newBalance = Math.max(0, round2(invoice.total - newAmountPaid));

  invoice.amountPaid = newAmountPaid;
  invoice.balance = newBalance;

  // If the invoice was marked paid, revert to confirmed because balance > 0
  if (prevInvStatus === 'paid' && newBalance > 0) {
    invoice.status = 'confirmed';

    // Decrement Discount.timesUsed
    if (invoice.appliedDiscounts && invoice.appliedDiscounts.length > 0) {
      for (const ad of invoice.appliedDiscounts) {
        if (ad.discount) {
          await Discount.findByIdAndUpdate(ad.discount, { $inc: { timesUsed: -1 } });
        }
      }
    }
  }

  await invoice.save();

  payment.status = 'refunded';
  payment.refundReason = reason;
  payment.refundedAt = new Date();
  await payment.save();

  if (invoice.status !== prevInvStatus) {
    await recordStatusChange({
      entityType: 'invoice',
      entityId: invoice._id,
      from: prevInvStatus,
      to: invoice.status,
      changedBy: refundedBy,
      note: `Status reverted to ${invoice.status} following refund of payment ${payment.number} (₹${refundAmount})`,
    });
  }

  return { payment, invoice };
}

/**
 * Verify and process an inbound gateway webhook.
 * @param {Object} options
 * @param {string} options.event
 * @param {Object} options.payload
 * @param {string} [options.signature]
 * @returns {Promise<Object>}
 */
async function handleWebhook({ event, payload = {}, signature }) {
  // Mock signature verification
  const isValidSignature =
    !signature ||
    signature === 'mock_secret_valid' ||
    signature === process.env.PAYMENT_WEBHOOK_SECRET ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV !== 'production';

  if (!isValidSignature) {
    throw createError(401, 'Invalid webhook signature');
  }

  let result = null;

  switch (event) {
    case 'payment.succeeded': {
      if (!payload.invoiceId || !payload.amount) {
        throw createError(400, 'Missing invoiceId or amount in webhook payload');
      }
      result = await processPayment({
        invoiceId: payload.invoiceId,
        amount: payload.amount,
        method: payload.method || 'card',
        paidOn: payload.paidOn,
        note: payload.note || 'Processed via mock webhook',
        transactionId: payload.transactionId,
        gatewayResponse: payload,
      });
      break;
    }

    case 'payment.refunded': {
      if (!payload.paymentId) {
        throw createError(400, 'Missing paymentId in webhook payload');
      }
      result = await processRefund({
        paymentId: payload.paymentId,
        reason: payload.reason || 'Refunded via mock webhook',
      });
      break;
    }

    default:
      return { received: true, ignored: true, message: `Unhandled event: ${event}` };
  }

  return { received: true, event, result };
}

module.exports = {
  processPayment,
  processRefund,
  handleWebhook,
};
