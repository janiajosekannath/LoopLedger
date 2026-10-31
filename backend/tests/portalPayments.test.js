/**
 * tests/portalPayments.test.js
 * Tests for customer portal invoice view, scoping, and payment checkout.
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

let mongoServer;
let customer1;
let customer2;
let customer1Token;
let customer2Token;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  customer1 = await Customer.create({
    name: 'Pooja Singh',
    email: 'pooja@singhenterprises.com',
    company: 'Singh Enterprises',
  });

  customer2 = await Customer.create({
    name: 'Amit Desai',
    email: 'amit@desaitech.com',
    company: 'Desai Tech',
  });

  const user1 = await User.create({
    name: 'Pooja Singh',
    email: 'pooja@singhenterprises.com',
    passwordHash: 'hashed',
    role: 'customer',
    customer: customer1._id,
  });

  const user2 = await User.create({
    name: 'Amit Desai',
    email: 'amit@desaitech.com',
    passwordHash: 'hashed',
    role: 'customer',
    customer: customer2._id,
  });

  customer1Token = jwt.sign(
    { userId: user1._id, role: 'customer', customerId: customer1._id.toString() },
    process.env.JWT_SECRET
  );

  customer2Token = jwt.sign(
    { userId: user2._id, role: 'customer', customerId: customer2._id.toString() },
    process.env.JWT_SECRET
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Customer 1 invoice
  await Invoice.create({
    number: 'INV-CUST1-01',
    customer: customer1._id,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 10 * 86400000),
    total: 7500,
    amountPaid: 0,
    balance: 7500,
    status: 'confirmed',
  });

  // Customer 2 invoice
  await Invoice.create({
    number: 'INV-CUST2-01',
    customer: customer2._id,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 10 * 86400000),
    total: 15000,
    amountPaid: 0,
    balance: 15000,
    status: 'confirmed',
  });
});

afterEach(async () => {
  await Invoice.deleteMany({});
  await Payment.deleteMany({});
});

describe('Phase 6: Customer Portal Invoices & Payments Scoping', () => {
  test('Customer 1 can only fetch their own invoices from GET /api/invoices', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].number).toBe('INV-CUST1-01');
    expect(res.body.data[0].customer._id.toString()).toBe(customer1._id.toString());
  });

  test('Customer 1 cannot fetch Customer 2 invoice by ID (403 Forbidden)', async () => {
    const cust2Inv = await Invoice.findOne({ customer: customer2._id });

    const res = await request(app)
      .get(`/api/invoices/${cust2Inv._id}`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(res.status).toBe(403);
  });

  test('Customer 1 can pay their own invoice via POST /api/payments/:invoiceId/pay', async () => {
    const cust1Inv = await Invoice.findOne({ customer: customer1._id });

    const res = await request(app)
      .post(`/api/payments/${cust1Inv._id}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        amount: 7500,
        method: 'card',
        cardDetails: {
          cardNumber: '4111111111111234',
          expiryMonth: '12',
          expiryYear: '28',
          cvv: '123',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoice.status).toBe('paid');
    expect(res.body.data.invoice.balance).toBe(0);

    const payment = await Payment.findOne({ invoice: cust1Inv._id });
    expect(payment).toBeTruthy();
    expect(payment.customer.toString()).toBe(customer1._id.toString());
  });

  test('Customer 1 cannot pay Customer 2 invoice (403 Forbidden)', async () => {
    const cust2Inv = await Invoice.findOne({ customer: customer2._id });

    const res = await request(app)
      .post(`/api/payments/${cust2Inv._id}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        amount: 5000,
        method: 'upi',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permission/i);
  });
});
