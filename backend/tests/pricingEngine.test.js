const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long';
process.env.NODE_ENV = 'test';

const { Product, ProductVariant } = require('../src/models/Product');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const Tax = require('../src/models/Tax');
const Discount = require('../src/models/Discount');
const Customer = require('../src/models/Customer');
const { quote } = require('../src/services/pricingEngine');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
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

describe('Pricing Engine (Single Source of Truth)', () => {
  test('Calculates unit price = product sales price + variant extra price (₹1,000 + ₹560 = ₹1,560)', async () => {
    const tax18 = await Tax.create({ name: 'GST 18%', percent: 18, active: true });
    const product = await Product.create({
      name: 'Business Software Suite',
      type: 'subscription',
      salesPrice: 1000,
      costPrice: 400,
      tax: tax18._id,
    });
    const variant = await ProductVariant.create({
      product: product._id,
      attribute: 'Brand',
      value: 'Odoo Edition',
      extraPrice: 560,
    });

    const result = await quote({
      lines: [
        {
          product: product._id.toString(),
          variant: variant._id.toString(),
          quantity: 2,
        },
      ],
    });

    // 1000 + 560 = 1560 per unit
    // subtotal = 1560 * 2 = 3120
    // tax = 3120 * 18% = 561.6
    // total = 3120 + 561.6 = 3681.6
    expect(result.lines[0].unitPrice).toBe(1560);
    expect(result.subtotal).toBe(3120);
    expect(result.discountTotal).toBe(0);
    expect(result.taxTotal).toBe(561.6);
    expect(result.total).toBe(3681.6);
  });

  test('Enforces plan.minQty threshold and throws if current quantity is below it', async () => {
    const product = await Product.create({
      name: 'Team Seat',
      type: 'service',
      salesPrice: 500,
    });
    const plan = await SubscriptionPlan.create({
      name: 'Enterprise Plan (min 5 seats)',
      product: product._id,
      price: 500,
      billingPeriod: 'monthly',
      minQty: 5,
    });

    // Attempting with quantity 3 should throw
    await expect(
      quote({
        planId: plan._id.toString(),
        lines: [{ product: product._id.toString(), quantity: 3 }],
      })
    ).rejects.toThrow(/minimum quantity of 5/i);

    // With quantity 5 it should succeed
    const ok = await quote({
      planId: plan._id.toString(),
      lines: [{ product: product._id.toString(), quantity: 5 }],
    });
    expect(ok.subtotal).toBe(2500);
  });

  test('Applies 10% discount at 10+ seats rule and calculates tax on discounted base', async () => {
    const tax18 = await Tax.create({ name: 'GST 18%', percent: 18, active: true });
    const product = await Product.create({
      name: 'SaaS User License',
      salesPrice: 1000,
      tax: tax18._id,
    });

    // 10% discount for 10+ seats
    const discount = await Discount.create({
      name: '10% at 10+ Seats',
      type: 'percent',
      value: 10,
      minQty: 10,
      scope: 'product',
      products: [product._id],
      active: true,
      timesUsed: 0,
      usageLimit: 100,
    });

    const result = await quote({
      lines: [{ product: product._id.toString(), quantity: 10 }],
    });

    // 10 * 1000 = 10,000 subtotal
    // 10% discount = 1,000
    // discounted base = 9,000
    // tax on 9,000 at 18% = 1,620
    // total = 9000 + 1620 = 10,620
    expect(result.subtotal).toBe(10000);
    expect(result.discountTotal).toBe(1000);
    expect(result.taxTotal).toBe(1620);
    expect(result.total).toBe(10620);
    expect(result.appliedDiscounts.length).toBe(1);

    // CRITICAL: quote() must NEVER change usage counters
    const refetchedDiscount = await Discount.findById(discount._id);
    expect(refetchedDiscount.timesUsed).toBe(0);
  });

  test('Expired or exhausted discount is never applied', async () => {
    const product = await Product.create({ name: 'Dev Server', salesPrice: 2000 });

    // Expired discount
    await Discount.create({
      name: 'Old Promo 2020',
      type: 'percent',
      value: 20,
      scope: 'product',
      products: [product._id],
      startDate: new Date('2020-01-01'),
      endDate: new Date('2020-02-01'),
      active: true,
    });

    // Exhausted discount
    await Discount.create({
      name: 'Limited First 5',
      type: 'fixed',
      value: 500,
      scope: 'product',
      products: [product._id],
      usageLimit: 5,
      timesUsed: 5,
      active: true,
    });

    const result = await quote({
      lines: [{ product: product._id.toString(), quantity: 1 }],
    });

    expect(result.subtotal).toBe(2000);
    expect(result.discountTotal).toBe(0);
    expect(result.total).toBe(2000);
    expect(result.appliedDiscounts.length).toBe(0);
  });
});
