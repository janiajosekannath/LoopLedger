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
let adminToken;
let customer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin_pay@test.com',
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
    name: 'Infosys BPM',
    email: 'finance@infosys.com',
    company: 'Infosys Limited',
  });
});

afterEach(async () => {
  await Payment.deleteMany({});
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
});

describe('Payment Processing', () => {
  test('Records payment, updates invoice amountPaid and balance, marks paid at zero balance', async () => {
    const invoice = await Invoice.create({
      number: 'INV-100001',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      total: 5000,
      amountPaid: 0,
      balance: 5000,
      status: 'confirmed',
    });

    // 1. Partial payment of ₹2,000
    const partRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice: invoice._id.toString(),
        method: 'bank_transfer',
        amount: 2000,
        note: 'First installment via NEFT',
      });

    expect(partRes.status).toBe(201);
    expect(partRes.body.success).toBe(true);
    expect(partRes.body.data.payment.number).toMatch(/^PAY-\d{6}$/);
    expect(partRes.body.data.invoice.amountPaid).toBe(2000);
    expect(partRes.body.data.invoice.balance).toBe(3000);
    expect(partRes.body.data.invoice.status).toBe('confirmed');

    // 2. Remaining payment of ₹3,000
    const finalRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice: invoice._id.toString(),
        method: 'upi',
        amount: 3000,
        note: 'Final settlement via UPI',
      });

    expect(finalRes.status).toBe(201);
    expect(finalRes.body.data.invoice.amountPaid).toBe(5000);
    expect(finalRes.body.data.invoice.balance).toBe(0);
    expect(finalRes.body.data.invoice.status).toBe('paid');
  });

  test('Rejects payment amount exceeding current balance', async () => {
    const invoice = await Invoice.create({
      number: 'INV-100002',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(),
      total: 1000,
      amountPaid: 800,
      balance: 200,
      status: 'confirmed',
    });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice: invoice._id.toString(),
        method: 'card',
        amount: 500, // exceeds balance of 200
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot exceed/i);
  });
});
