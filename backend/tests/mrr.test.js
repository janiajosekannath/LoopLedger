/**
 * tests/mrr.test.js
 * Phase 7 – Unit tests for MRR calculation and reports service
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long';
process.env.NODE_ENV = 'test';

const { calculateMrr, recordMrrChange } = require('../src/services/mrr');
const { getDashboardSummary, getMrrWaterfall, getRevenueBreakdown, getChurnAnalysis } = require('../src/services/reportsService');
const Subscription = require('../src/models/Subscription');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const Customer = require('../src/models/Customer');
const Invoice = require('../src/models/Invoice');
const { MrrChange } = require('../src/models/History');

let mongoServer;
let seqCounter = 0;
const uniq = (prefix) => `${prefix}-${++seqCounter}-${Date.now()}`;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ─── calculateMrr() unit tests ────────────────────────────────────────────────

describe('calculateMrr()', () => {
  const makeSub = (subtotal, discountTotal, billingPeriod) => ({
    subtotal,
    discountTotal,
    plan: { billingPeriod },
  });

  test('monthly subscription: baseRevenue = subtotal - discount', () => {
    expect(calculateMrr(makeSub(5000, 500, 'monthly'))).toBe(4500);
  });

  test('yearly subscription: normalised to 1/12 per month', () => {
    expect(calculateMrr(makeSub(12000, 0, 'yearly'))).toBe(1000);
  });

  test('weekly subscription: normalised to 52/12 weeks', () => {
    expect(calculateMrr(makeSub(1000, 0, 'weekly'))).toBeCloseTo((1000 * 52) / 12, 1);
  });

  test('daily subscription: * 30 days', () => {
    expect(calculateMrr(makeSub(100, 0, 'daily'))).toBe(3000);
  });

  test('discount cannot make MRR negative', () => {
    expect(calculateMrr(makeSub(100, 500, 'monthly'))).toBe(0);
  });

  test('defaults to monthly if billingPeriod missing', () => {
    expect(calculateMrr({ subtotal: 2000, discountTotal: 0 })).toBe(2000);
  });
});

// ─── recordMrrChange() ────────────────────────────────────────────────────────

describe('recordMrrChange()', () => {
  test('creates a MrrChange document', async () => {
    const sub = await Subscription.create({
      number: uniq('SUB'),
      customer: new mongoose.Types.ObjectId(),
      plan: new mongoose.Types.ObjectId(),
      startDate: new Date(),
      status: 'active',
      subtotal: 1000, discountTotal: 0, taxTotal: 0, total: 1000,
    });
    const change = await recordMrrChange({ subscriptionId: sub._id, type: 'new', amount: 1000 });
    expect(change.type).toBe('new');
    expect(change.amount).toBe(1000);
    expect(change.subscription.toString()).toBe(sub._id.toString());
  });

  test('throws if subscriptionId missing', async () => {
    await expect(recordMrrChange({ type: 'churn', amount: 500 })).rejects.toThrow();
  });
});

// ─── getDashboardSummary() ────────────────────────────────────────────────────

describe('getDashboardSummary()', () => {
  let customerId, planId;

  beforeEach(async () => {
    const plan = await SubscriptionPlan.create({
      name: 'Pro Plan',
      billingPeriod: 'monthly',
      price: 2000,
      product: new mongoose.Types.ObjectId(),
    });
    planId = plan._id;

    const customer = await Customer.create({
      name: 'Test Customer',
      email: `test-${Date.now()}@test.com`,
      registeredAt: new Date(),
    });
    customerId = customer._id;
  });

  test('returns zero metrics with no subscriptions', async () => {
    const summary = await getDashboardSummary();
    expect(summary.mrr).toBe(0);
    expect(summary.arr).toBe(0);
    expect(summary.activeSubscriptions).toBe(0);
    expect(summary.overdueCount).toBe(0);
  });

  test('counts active subscriptions and computes MRR', async () => {
    await Subscription.create([
      {
        number: uniq('SUB'),
        customer: customerId, plan: planId, startDate: new Date(),
        status: 'active', subtotal: 3000, discountTotal: 0, taxTotal: 0, total: 3000,
      },
      {
        number: uniq('SUB'),
        customer: customerId, plan: planId, startDate: new Date(),
        status: 'active', subtotal: 2000, discountTotal: 500, taxTotal: 0, total: 1500,
      },
    ]);

    const summary = await getDashboardSummary();
    expect(summary.activeSubscriptions).toBe(2);
    expect(summary.mrr).toBe(4500);   // 3000 + (2000-500)
    expect(summary.arr).toBe(54000);  // 4500 * 12
  });

  test('counts overdue invoices correctly', async () => {
    const pastDate = new Date(Date.now() - 30 * 86400000);
    await Invoice.create({
      number: uniq('INV'),
      customer: customerId, issueDate: pastDate, dueDate: pastDate,
      lines: [], subtotal: 1000, discountTotal: 0, taxTotal: 0, total: 1000,
      amountPaid: 0, balance: 1000, status: 'confirmed',
    });

    const summary = await getDashboardSummary();
    expect(summary.overdueCount).toBe(1);
    expect(summary.outstanding).toBe(1000);
  });
});

// ─── getMrrWaterfall() ────────────────────────────────────────────────────────

describe('getMrrWaterfall()', () => {
  test('returns array of correct length', async () => {
    const result = await getMrrWaterfall(6);
    expect(result).toHaveLength(6);
  });

  test('each period has required keys', async () => {
    const result = await getMrrWaterfall(3);
    result.forEach((p) => {
      expect(p).toHaveProperty('period');
      expect(p).toHaveProperty('label');
      expect(p).toHaveProperty('mrr');
      expect(p).toHaveProperty('arr');
      expect(p).toHaveProperty('new');
      expect(p).toHaveProperty('churn');
    });
  });

  test('MrrChange events are reflected in waterfall', async () => {
    const subId = new mongoose.Types.ObjectId();
    // Create a MrrChange for today (UTC)
    await MrrChange.create({ subscription: subId, type: 'new', amount: 5000, at: new Date() });

    const result = await getMrrWaterfall(12);
    const last = result[result.length - 1];
    expect(last.new).toBe(5000);
    expect(last.mrr).toBe(5000);
  });
});

// ─── getRevenueBreakdown() ────────────────────────────────────────────────────

describe('getRevenueBreakdown()', () => {
  test('returns correct month count', async () => {
    const result = await getRevenueBreakdown(6);
    expect(result).toHaveLength(6);
  });

  test('sums amountPaid for current month invoices', async () => {
    const now = new Date();
    await Invoice.create([
      {
        number: uniq('INV'),
        customer: new mongoose.Types.ObjectId(),
        issueDate: now, dueDate: now,
        subtotal: 1000, discountTotal: 0, taxTotal: 0, total: 1000,
        amountPaid: 800, balance: 200, status: 'paid', lines: [],
      },
      {
        number: uniq('INV'),
        customer: new mongoose.Types.ObjectId(),
        issueDate: now, dueDate: now,
        subtotal: 500, discountTotal: 0, taxTotal: 0, total: 500,
        amountPaid: 500, balance: 0, status: 'paid', lines: [],
      },
    ]);

    const result = await getRevenueBreakdown(12);
    const last = result[result.length - 1];
    expect(last.revenue).toBe(1300);
    expect(last.invoiceCount).toBe(2);
  });
});

// ─── getChurnAnalysis() ───────────────────────────────────────────────────────

describe('getChurnAnalysis()', () => {
  test('returns correct month count', async () => {
    const result = await getChurnAnalysis(6);
    expect(result).toHaveLength(6);
  });

  test('counts churned subscriptions in current month', async () => {
    const now = new Date();
    await Subscription.create([
      {
        number: uniq('SUB'),
        customer: new mongoose.Types.ObjectId(),
        plan: new mongoose.Types.ObjectId(),
        startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        closedAt: now, status: 'closed',
        subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0,
      },
      {
        number: uniq('SUB'),
        customer: new mongoose.Types.ObjectId(),
        plan: new mongoose.Types.ObjectId(),
        startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        closedAt: now, status: 'closed',
        subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0,
      },
    ]);

    const result = await getChurnAnalysis(12);
    const last = result[result.length - 1];
    expect(last.churned).toBe(2);
  });
});
