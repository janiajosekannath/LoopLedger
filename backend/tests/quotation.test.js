const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long';
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const User = require('../src/models/User');
const Customer = require('../src/models/Customer');
const { Product } = require('../src/models/Product');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const Quotation = require('../src/models/Quotation');
const Subscription = require('../src/models/Subscription');

let mongoServer;
let adminToken;
let customer;
let product;
let plan;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin_quo@test.com',
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
    name: 'Reliance Retail',
    email: 'retail@reliance.in',
    company: 'Reliance Industries',
  });

  product = await Product.create({
    name: 'Cloud POS Terminal',
    salesPrice: 5000,
  });

  plan = await SubscriptionPlan.create({
    name: 'Monthly POS Pro',
    product: product._id,
    price: 5000,
    billingPeriod: 'monthly',
  });
});

afterEach(async () => {
  await Quotation.deleteMany({});
  await Subscription.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await SubscriptionPlan.deleteMany({});
});

describe('Quotation Lifecycle & Confirmation', () => {
  test('Creates quotation with QUO- sequence and calculated totals', async () => {
    const res = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer: customer._id.toString(),
        plan: plan._id.toString(),
        validityDays: 15,
        lines: [{ product: product._id.toString(), quantity: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.number).toMatch(/^QUO-\d{6}$/);
    expect(res.body.data.subtotal).toBe(10000);
    expect(res.body.data.total).toBe(10000);
    expect(res.body.data.status).toBe('draft');
  });

  test('POST /api/quotations/:id/confirm creates linked subscription and prevents re-entry', async () => {
    // 1. Create quote
    const createRes = await request(app)
      .post('/api/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer: customer._id.toString(),
        plan: plan._id.toString(),
        lines: [{ product: product._id.toString(), quantity: 1 }],
      });

    const quoteId = createRes.body.data._id;

    // 2. Confirm quote
    const confirmRes = await request(app)
      .post(`/api/quotations/${quoteId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.quotation.status).toBe('confirmed');
    expect(confirmRes.body.data.subscription).toBeDefined();
    expect(confirmRes.body.data.subscription.number).toMatch(/^SUB-\d{6}$/);
    expect(confirmRes.body.data.subscription.status).toBe('confirmed');

    // Verify DB linkage
    const linkedSub = await Subscription.findById(confirmRes.body.data.subscription._id);
    expect(linkedSub.quotation.toString()).toBe(quoteId);

    // 3. Second confirm must fail (no re-entry)
    const secondConfirmRes = await request(app)
      .post(`/api/quotations/${quoteId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(secondConfirmRes.status).toBe(400);
    expect(secondConfirmRes.body.message).toMatch(/already confirmed/i);
  });

  test('Expired quotation cannot be confirmed', async () => {
    // Create quotation with past validity date
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    const quoteDoc = await Quotation.create({
      number: 'QUO-999999',
      customer: customer._id,
      plan: plan._id,
      lines: [{ product: product._id, quantity: 1, unitPrice: 5000, amount: 5000 }],
      subtotal: 5000,
      total: 5000,
      validUntil: pastDate,
      status: 'draft',
    });

    const res = await request(app)
      .post(`/api/quotations/${quoteDoc._id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });
});
