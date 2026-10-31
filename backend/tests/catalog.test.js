const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const app = require('../src/app');
const User = require('../src/models/User');
const Tax = require('../src/models/Tax');
const { Product, ProductVariant } = require('../src/models/Product');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const Discount = require('../src/models/Discount');

let mongoServer;
let adminToken;
let staffToken;
let customerToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Setup Admin
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    passwordHash: await bcrypt.hash('Admin@1234!', 10),
    role: 'admin',
  });
  adminToken = jwt.sign({ userId: admin._id, role: 'admin' }, process.env.JWT_SECRET);

  // Setup Staff
  const staff = await User.create({
    name: 'Staff',
    email: 'staff@test.com',
    passwordHash: await bcrypt.hash('Staff@1234!', 10),
    role: 'staff',
  });
  staffToken = jwt.sign({ userId: staff._id, role: 'staff' }, process.env.JWT_SECRET);

  // Setup Customer
  const cust = await User.create({
    name: 'Customer',
    email: 'customer@test.com',
    passwordHash: await bcrypt.hash('Cust@1234!', 10),
    role: 'customer',
  });
  customerToken = jwt.sign({ userId: cust._id, role: 'customer' }, process.env.JWT_SECRET);
});

describe('Taxes API', () => {
  test('admin can create tax and staff can read it', async () => {
    const resCreate = await request(app)
      .post('/api/taxes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'GST 18%',
        percent: 18,
        description: 'Standard Goods & Services Tax',
      });
    expect(resCreate.status).toBe(201);
    expect(resCreate.body.data.percent).toBe(18);

    const resList = await request(app)
      .get('/api/taxes')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(resList.status).toBe(200);
    expect(resList.body.data.length).toBe(1);
  });

  test('staff and customer cannot write taxes', async () => {
    const resStaff = await request(app)
      .post('/api/taxes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Illegal Tax', percent: 10 });
    expect(resStaff.status).toBe(403);

    const resCust = await request(app)
      .post('/api/taxes')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Illegal Tax', percent: 10 });
    expect(resCust.status).toBe(403);
  });

  test('toggle active status on tax', async () => {
    const tax = await Tax.create({ name: 'GST 5%', percent: 5, active: true });
    const res = await request(app)
      .patch(`/api/taxes/${tax._id}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });
});

describe('Products & Variants API', () => {
  test('admin can create product with initial variants and price calculation', async () => {
    const tax = await Tax.create({ name: 'GST 18%', percent: 18 });

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Business Software Suite',
        type: 'subscription',
        salesPrice: 1000,
        costPrice: 400,
        tax: tax._id,
        variants: [
          { attribute: 'Brand', value: 'Odoo Edition', extraPrice: 560 },
          { attribute: 'Brand', value: 'Standard Edition', extraPrice: 0 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Business Software Suite');
    expect(res.body.data.variants.length).toBe(2);

    const odooVariant = res.body.data.variants.find((v) => v.value === 'Odoo Edition');
    expect(odooVariant.extraPrice).toBe(560);
    // Calculated total: 1000 + 560 = 1560
    expect(res.body.data.salesPrice + odooVariant.extraPrice).toBe(1560);
  });

  test('duplicate variant attribute+value rejected with 409', async () => {
    const product = await Product.create({
      name: 'Cloud Hosting',
      salesPrice: 500,
    });

    await request(app)
      .post(`/api/products/${product._id}/variants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attribute: 'Storage', value: '100GB', extraPrice: 100 });

    const resDup = await request(app)
      .post(`/api/products/${product._id}/variants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attribute: 'Storage', value: '100GB', extraPrice: 150 });

    expect(resDup.status).toBe(409);
  });
});

describe('Subscription Plans API', () => {
  test('creates plan and validates availableTo after availableFrom', async () => {
    const product = await Product.create({
      name: 'Support Services',
      salesPrice: 500,
    });

    // Invalid dates (availableTo before availableFrom) fails
    const resInvalid = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Invalid Date Plan',
        product: product._id,
        price: 1000,
        billingPeriod: 'monthly',
        availableFrom: '2026-12-01',
        availableTo: '2026-11-01',
      });
    expect(resInvalid.status).toBe(400);

    // Valid plan with flags passes
    const resValid = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Enterprise Plan',
        product: product._id,
        price: 2500,
        billingPeriod: 'monthly',
        minQty: 5,
        availableFrom: '2026-01-01',
        availableTo: '2026-12-31',
        autoClose: false,
        allowEarlyClose: true,
        allowPause: true,
        allowRenew: true,
        active: true,
      });
    expect(resValid.status).toBe(201);
    expect(resValid.body.data.allowPause).toBe(true);
    expect(resValid.body.data.minQty).toBe(5);
  });
});

describe('Discounts API', () => {
  test('admin can create discount with validation', async () => {
    // Percent > 100 rejected
    const resPercentFail = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Crazy Discount',
        type: 'percent',
        value: 120,
        scope: 'subscription',
      });
    expect(resPercentFail.status).toBe(400);

    // Valid discount passes
    const resValid = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '10% at 10 Seats',
        type: 'percent',
        value: 10,
        minQty: 10,
        scope: 'subscription',
        usageLimit: 100,
      });

    expect(resValid.status).toBe(201);
    expect(resValid.body.data.computedStatus).toBe('active');
  });

  test('staff cannot write discounts (403)', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Staff Promo',
        type: 'fixed',
        value: 50,
        scope: 'subscription',
      });
    expect(res.status).toBe(403);
  });

  test('updating usageLimit below timesUsed is rejected (400)', async () => {
    const disc = await Discount.create({
      name: 'Used Promo',
      type: 'fixed',
      value: 100,
      scope: 'subscription',
      timesUsed: 10,
      usageLimit: 20,
    });

    const res = await request(app)
      .put(`/api/discounts/${disc._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        usageLimit: 5, // lower than timesUsed (10)
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('cannot be lower than timesUsed');
  });
});
