/**
 * tests/payments.test.js
 * Comprehensive tests for payment processing, discount counters, refunds, and webhooks.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long';
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const User = require('../src/models/User');
const Customer = require('../src/models/Customer');
const Invoice = require('../src/models/Invoice');
const Payment = require('../src/models/Payment');
const Discount = require('../src/models/Discount');

let mongoServer;
let adminToken;
let customer;
let discount;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin_payments@test.com',
    passwordHash: 'hashed',
    role: 'admin',
  });
  adminToken = jwt.sign({ userId: admin._id, role: 'admin' }, process.env.JWT_SECRET);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  customer = await Customer.create({
    name: 'Tata Consultancy Services',
    email: 'billing@tcs.com',
    company: 'TCS Limited',
  });

  discount = await Discount.create({
    name: 'Festive 10%',
    type: 'percent',
    scope: 'subscription',
    value: 10,
    timesUsed: 0,
    usageLimit: 100,
    active: true,
  });
});

afterEach(async () => {
  await Payment.deleteMany({});
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
  await Discount.deleteMany({});
});

describe('Phase 6: Payment Processing & Settlement', () => {
  test('Partial payment leaves status confirmed with correct balance', async () => {
    const invoice = await Invoice.create({
      number: 'INV-200001',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 86400000),
      total: 10000,
      amountPaid: 0,
      balance: 10000,
      status: 'confirmed',
    });

    const res = await request(app)
      .post(`/api/payments/${invoice._id}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 4000,
        method: 'card',
        note: 'Partial payment 1',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.amountPaid).toBe(4000);
    expect(res.body.data.invoice.balance).toBe(6000);
    expect(res.body.data.invoice.status).toBe('confirmed');

    const updatedInv = await Invoice.findById(invoice._id);
    expect(updatedInv.balance).toBe(6000);
    expect(updatedInv.status).toBe('confirmed');
  });

  test('Full payment updates balance to 0, sets status to paid, and increments Discount.timesUsed', async () => {
    const invoice = await Invoice.create({
      number: 'INV-200002',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 86400000),
      total: 5000,
      amountPaid: 0,
      balance: 5000,
      status: 'confirmed',
      appliedDiscounts: [{ discount: discount._id, amount: 500 }],
    });

    // Verify discount timesUsed starts at 0
    let freshDiscount = await Discount.findById(discount._id);
    expect(freshDiscount.timesUsed).toBe(0);

    const res = await request(app)
      .post(`/api/payments/${invoice._id}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 5000,
        method: 'upi',
        upiId: 'finance@tcs.okhdfcbank',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice.amountPaid).toBe(5000);
    expect(res.body.data.invoice.balance).toBe(0);
    expect(res.body.data.invoice.status).toBe('paid');

    // Verify discount timesUsed is now incremented
    freshDiscount = await Discount.findById(discount._id);
    expect(freshDiscount.timesUsed).toBe(1);
  });

  test('Refund reverts invoice balance, reverts status to confirmed, and decrements Discount.timesUsed', async () => {
    const invoice = await Invoice.create({
      number: 'INV-200003',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 86400000),
      total: 3000,
      amountPaid: 0,
      balance: 3000,
      status: 'confirmed',
      appliedDiscounts: [{ discount: discount._id, amount: 300 }],
    });

    // 1. Pay in full
    const payRes = await request(app)
      .post(`/api/payments/${invoice._id}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 3000,
        method: 'card',
      });

    const paymentId = payRes.body.data.payment._id;
    let disc = await Discount.findById(discount._id);
    expect(disc.timesUsed).toBe(1);

    // 2. Refund the payment
    const refundRes = await request(app)
      .patch(`/api/payments/${paymentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Duplicate charge reported by customer',
      });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.success).toBe(true);
    expect(refundRes.body.data.payment.status).toBe('refunded');
    expect(refundRes.body.data.invoice.status).toBe('confirmed');
    expect(refundRes.body.data.invoice.balance).toBe(3000);
    expect(refundRes.body.data.invoice.amountPaid).toBe(0);

    // Verify discount decremented
    disc = await Discount.findById(discount._id);
    expect(disc.timesUsed).toBe(0);
  });

  test('Mock Webhook handles payment.succeeded and settles invoice', async () => {
    const invoice = await Invoice.create({
      number: 'INV-200004',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(),
      total: 4500,
      amountPaid: 0,
      balance: 4500,
      status: 'confirmed',
    });

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('x-mock-signature', 'mock_secret_valid')
      .send({
        event: 'payment.succeeded',
        payload: {
          invoiceId: invoice._id.toString(),
          amount: 4500,
          method: 'card',
          transactionId: 'TXN-GATEWAY-9999',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result.invoice.status).toBe('paid');
    expect(res.body.data.result.invoice.balance).toBe(0);
  });
});
