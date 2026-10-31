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
const Subscription = require('../src/models/Subscription');
const { MrrChange, StatusHistory } = require('../src/models/History');
const { autoCloseSubscriptions } = require('../src/jobs/autoClose');

let mongoServer;
let adminToken;
let customer;
let product;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin_sub@test.com',
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
    email: 'cloud@tcs.in',
    company: 'Tata Group',
  });

  product = await Product.create({
    name: 'Enterprise Cloud Server',
    salesPrice: 10000,
  });
});

afterEach(async () => {
  await Subscription.deleteMany({});
  await SubscriptionPlan.deleteMany({});
  await MrrChange.deleteMany({});
  await StatusHistory.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
});

describe('Subscription Lifecycle & Policy Flags', () => {
  test('Activating subscription sets nextBillingDate and writes MrrChange "new"', async () => {
    const plan = await SubscriptionPlan.create({
      name: 'Enterprise Plan',
      product: product._id,
      price: 10000,
      billingPeriod: 'monthly',
      allowPause: true,
      allowEarlyClose: true,
      allowRenew: true,
    });

    const sub = await Subscription.create({
      number: 'SUB-100001',
      customer: customer._id,
      plan: plan._id,
      startDate: new Date(),
      subtotal: 10000,
      discountTotal: 0,
      taxTotal: 0,
      total: 10000,
      status: 'confirmed',
    });

    const res = await request(app)
      .post(`/api/subscriptions/${sub._id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.nextBillingDate).toBeDefined();

    // Verify MrrChange was recorded
    const mrrEntry = await MrrChange.findOne({ subscription: sub._id, type: 'new' });
    expect(mrrEntry).toBeDefined();
    expect(mrrEntry.amount).toBe(10000);
  });

  test('Plan policy allowPause: false blocks pausing for staff and customers', async () => {
    const strictPlan = await SubscriptionPlan.create({
      name: 'Non-Pausable Annual',
      product: product._id,
      price: 10000,
      billingPeriod: 'yearly',
      allowPause: false, // PAUSE NOT ALLOWED
    });

    const sub = await Subscription.create({
      number: 'SUB-100002',
      customer: customer._id,
      plan: strictPlan._id,
      startDate: new Date(),
      status: 'active',
      subtotal: 10000,
      total: 10000,
    });

    const res = await request(app)
      .post(`/api/subscriptions/${sub._id}/pause`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/policy does not permit pausing/i);
  });

  test('Plan policy allowEarlyClose: false blocks early closure', async () => {
    const strictPlan = await SubscriptionPlan.create({
      name: 'Locked 1-Year Plan',
      product: product._id,
      price: 10000,
      billingPeriod: 'yearly',
      allowEarlyClose: false, // NO EARLY CLOSE
    });

    const futureExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 6 months in future

    const sub = await Subscription.create({
      number: 'SUB-100003',
      customer: customer._id,
      plan: strictPlan._id,
      startDate: new Date(),
      expiryDate: futureExpiry,
      status: 'active',
      subtotal: 10000,
      total: 10000,
    });

    const res = await request(app)
      .post(`/api/subscriptions/${sub._id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/early closure/i);
  });

  test('Plan policy allowRenew: false blocks renewal', async () => {
    const nonRenewablePlan = await SubscriptionPlan.create({
      name: 'One-off Special',
      product: product._id,
      price: 10000,
      billingPeriod: 'monthly',
      allowRenew: false, // NO RENEW
    });

    const sub = await Subscription.create({
      number: 'SUB-100004',
      customer: customer._id,
      plan: nonRenewablePlan._id,
      startDate: new Date(),
      status: 'active',
      subtotal: 10000,
      total: 10000,
    });

    const res = await request(app)
      .post(`/api/subscriptions/${sub._id}/renew`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/policy does not permit renew/i);
  });

  test('Daily auto-close cron closes expired active subscriptions with autoClose: true', async () => {
    const autoClosePlan = await SubscriptionPlan.create({
      name: 'Trial Auto-Close Plan',
      product: product._id,
      price: 2000,
      billingPeriod: 'monthly',
      autoClose: true,
    });

    const manualClosePlan = await SubscriptionPlan.create({
      name: 'Continuous Plan',
      product: product._id,
      price: 5000,
      billingPeriod: 'monthly',
      autoClose: false,
    });

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

    // Sub 1: Should be closed
    const sub1 = await Subscription.create({
      number: 'SUB-AUTOCLOSE-1',
      customer: customer._id,
      plan: autoClosePlan._id,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      expiryDate: pastDate,
      status: 'active',
      subtotal: 2000,
      total: 2000,
    });

    // Sub 2: Should remain active (autoClose is false)
    const sub2 = await Subscription.create({
      number: 'SUB-AUTOCLOSE-2',
      customer: customer._id,
      plan: manualClosePlan._id,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      expiryDate: pastDate,
      status: 'active',
      subtotal: 5000,
      total: 5000,
    });

    // Execute the cron function
    const cronResult = await autoCloseSubscriptions(new Date());
    expect(cronResult.closed).toBe(1);

    const updatedSub1 = await Subscription.findById(sub1._id);
    expect(updatedSub1.status).toBe('closed');
    expect(updatedSub1.closedAt).toBeDefined();

    const updatedSub2 = await Subscription.findById(sub2._id);
    expect(updatedSub2.status).toBe('active');

    // Churn record logged in MrrChange
    const churn = await MrrChange.findOne({ subscription: sub1._id, type: 'churn' });
    expect(churn).toBeDefined();
    expect(churn.amount).toBe(2000);
  });
});
