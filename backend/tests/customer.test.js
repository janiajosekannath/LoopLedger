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
const Customer = require('../src/models/Customer');
const Subscription = require('../src/models/Subscription');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const { Product, ProductVariant } = require('../src/models/Product');
const Invoice = require('../src/models/Invoice');
const Payment = require('../src/models/Payment');

let mongoServer;
let adminToken;
let staffToken;
let customer1Token;
let customer2Token;
let customer1Id;
let customer2Id;

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
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Setup Admin
  const adminHash = await bcrypt.hash('Admin@1234!', 10);
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@test.com',
    passwordHash: adminHash,
    role: 'admin',
  });
  adminToken = jwt.sign({ userId: admin._id, role: 'admin' }, process.env.JWT_SECRET);

  // Setup Staff
  const staffHash = await bcrypt.hash('Staff@1234!', 10);
  const staff = await User.create({
    name: 'Staff User',
    email: 'staff@test.com',
    passwordHash: staffHash,
    role: 'staff',
  });
  staffToken = jwt.sign({ userId: staff._id, role: 'staff' }, process.env.JWT_SECRET);

  // Setup Customer 1
  const cust1 = await Customer.create({
    name: 'Tata Consultancy Services',
    email: 'billing@tcs.com',
    phone: '+91 98765 11111',
    company: 'TCS Ltd',
    address: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  });
  customer1Id = cust1._id.toString();

  const cust1User = await User.create({
    name: 'TCS Admin',
    email: 'billing@tcs.com',
    passwordHash: await bcrypt.hash('Cust@1234!', 10),
    role: 'customer',
    customer: cust1._id,
  });
  customer1Token = jwt.sign(
    { userId: cust1User._id, role: 'customer', customerId: cust1._id },
    process.env.JWT_SECRET
  );

  // Setup Customer 2
  const cust2 = await Customer.create({
    name: 'Infosys BPM',
    email: 'finance@infosys.com',
    phone: '+91 98765 22222',
    company: 'Infosys Ltd',
    address: { city: 'Bangalore', state: 'Karnataka', country: 'India' },
  });
  customer2Id = cust2._id.toString();

  const cust2User = await User.create({
    name: 'Infosys Admin',
    email: 'finance@infosys.com',
    passwordHash: await bcrypt.hash('Cust@5678!', 10),
    role: 'customer',
    customer: cust2._id,
  });
  customer2Token = jwt.sign(
    { userId: cust2User._id, role: 'customer', customerId: cust2._id },
    process.env.JWT_SECRET
  );
});

describe('Customers API - Access Control & Authentication', () => {
  test('unauthenticated request is rejected with 401', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(401);
  });

  test('customer role is blocked from listing all customers (403)', async () => {
    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(res.status).toBe(403);
  });

  test('admin and staff can list customers', async () => {
    const resAdmin = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.success).toBe(true);
    expect(resAdmin.body.data.length).toBe(2);

    const resStaff = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(resStaff.status).toBe(200);
    expect(resStaff.body.data.length).toBe(2);
  });
});

describe('Customers API - Search & Pagination', () => {
  test('search by company or name filters results', async () => {
    const res = await request(app)
      .get('/api/customers?search=Mumbai')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);

    const resTcs = await request(app)
      .get('/api/customers?search=TCS')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(resTcs.status).toBe(200);
    expect(resTcs.body.data.length).toBe(1);
    expect(resTcs.body.data[0].email).toBe('billing@tcs.com');
  });

  test('pagination returns metadata', async () => {
    const res = await request(app)
      .get('/api/customers?page=1&limit=1')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.meta.totalPages).toBe(2);
    expect(res.body.meta.page).toBe(1);
  });
});

describe('Customers API - CRUD Operations', () => {
  test('creates customer with valid data', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Wipro Technologies',
        email: 'accounts@wipro.com',
        phone: '+91 98765 33333',
        company: 'Wipro Limited',
        address: {
          line1: 'Dodda Kannelli',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560035',
          country: 'India',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Wipro Technologies');
    expect(res.body.data.email).toBe('accounts@wipro.com');
  });

  test('rejects creation with duplicate email (409)', async () => {
    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Duplicate TCS',
        email: 'billing@tcs.com',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('updates customer fields', async () => {
    const res = await request(app)
      .put(`/api/customers/${customer1Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        company: 'Tata Consultancy Services Enterprise Ltd',
        phone: '+91 99999 88888',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.company).toBe('Tata Consultancy Services Enterprise Ltd');
    expect(res.body.data.phone).toBe('+91 99999 88888');
  });

  test('deletes customer without subscriptions or invoices', async () => {
    const res = await request(app)
      .delete(`/api/customers/${customer2Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await Customer.findById(customer2Id);
    expect(check).toBeNull();
  });

  test('blocks customer deletion if subscriptions exist (400)', async () => {
    const product = await Product.create({
      name: 'Cloud Hosting',
      salesPrice: 2000,
    });
    const plan = await SubscriptionPlan.create({
      name: 'Standard Cloud',
      product: product._id,
      price: 2000,
      billingPeriod: 'monthly',
    });

    await Subscription.create({
      number: 'SUB-000001',
      customer: customer1Id,
      plan: plan._id,
      startDate: new Date(),
      status: 'active',
    });

    const res = await request(app)
      .delete(`/api/customers/${customer1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('existing subscriptions');
  });
});

describe('Customers API - Sub-resources & Customer Isolation', () => {
  test('customer role can access own profile and sub-resources', async () => {
    const res = await request(app)
      .get(`/api/customers/${customer1Id}`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('billing@tcs.com');

    const resSubs = await request(app)
      .get(`/api/customers/${customer1Id}/subscriptions`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(resSubs.status).toBe(200);
    expect(Array.isArray(resSubs.body.data)).toBe(true);
  });

  test('customer role is blocked from viewing another customer (403)', async () => {
    const res = await request(app)
      .get(`/api/customers/${customer2Id}`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(res.status).toBe(403);

    const resSubs = await request(app)
      .get(`/api/customers/${customer2Id}/subscriptions`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(resSubs.status).toBe(403);

    const resInvs = await request(app)
      .get(`/api/customers/${customer2Id}/invoices`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(resInvs.status).toBe(403);

    const resPays = await request(app)
      .get(`/api/customers/${customer2Id}/payments`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(resPays.status).toBe(403);
  });
});
