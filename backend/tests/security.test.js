/**
 * tests/security.test.js — Comprehensive Security & RBAC Pass (Phase 8)
 *
 * Requirements:
 * - Walks routes and asserts authentication except public auth routes
 * - No responses include passwordHash or resetTokenHash
 * - Staff cannot write discounts (Admin only)
 * - Helmet security headers active
 * - Rate limiting configured
 * - No stack traces exposed in error responses
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

let mongoServer;
let adminUser, staffUser, customerUser;
let adminToken, staffToken, customerToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  adminUser = await User.create({
    name: 'Security Admin',
    email: 'sec_admin@loopledger.dev',
    passwordHash: 'secret_hash_value',
    role: 'admin',
    isActive: true,
  });
  adminToken = jwt.sign({ userId: adminUser._id, role: 'admin' }, process.env.JWT_SECRET);

  staffUser = await User.create({
    name: 'Security Staff',
    email: 'sec_staff@loopledger.dev',
    passwordHash: 'secret_hash_value',
    role: 'staff',
    isActive: true,
  });
  staffToken = jwt.sign({ userId: staffUser._id, role: 'staff' }, process.env.JWT_SECRET);

  const cust = await Customer.create({
    name: 'Portal User Org',
    email: 'sec_customer@loopledger.dev',
    company: 'SecureCorp',
  });

  customerUser = await User.create({
    name: 'Security Customer',
    email: 'sec_customer@loopledger.dev',
    passwordHash: 'secret_hash_value',
    role: 'customer',
    customerId: cust._id,
    isActive: true,
  });
  customerToken = jwt.sign(
    { userId: customerUser._id, role: 'customer', customerId: cust._id },
    process.env.JWT_SECRET
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Security & Authentication Route Traversal', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/auth/me' },
    { method: 'get', path: '/api/admin/staff' },
    { method: 'get', path: '/api/customers' },
    { method: 'post', path: '/api/products' },
    { method: 'post', path: '/api/plans' },
    { method: 'post', path: '/api/taxes' },
    { method: 'post', path: '/api/discounts' },
    { method: 'get', path: '/api/quotations' },
    { method: 'get', path: '/api/subscriptions' },
    { method: 'get', path: '/api/invoices' },
    { method: 'get', path: '/api/payments' },
    { method: 'post', path: '/api/billing/run' },
    { method: 'get', path: '/api/billing-runs' },
    { method: 'get', path: '/api/reminders' },
    { method: 'get', path: '/api/collections/aging' },
    { method: 'get', path: '/api/reports/summary' },
    { method: 'get', path: '/api/reports/revenue' },
    { method: 'get', path: '/api/reports/mrr-waterfall' },
  ];

  test.each(protectedRoutes)('Unauthenticated %s %s returns 401 Unauthorized', async ({ method, path }) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Public routes are accessible without token', async () => {
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.data.status).toBe('ok');

    const webhookRes = await request(app).post('/api/payments/webhook').send({});
    // Should be processed (400 on empty or 200, but NOT 401)
    expect(webhookRes.status).not.toBe(401);
  });
});

describe('Role-Based Access Control (RBAC) Enforcement', () => {
  test('Staff cannot write discounts (Admin only, 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: 'Staff Unauthorized Discount',
        type: 'percent',
        value: 15,
        scope: 'subscription',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 86400000),
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Customer cannot write discounts or catalog items (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/discounts')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Cust Discount', type: 'fixed', value: 100 });

    expect(res.status).toBe(403);

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Fake Product', salesPrice: 500 });

    expect(prodRes.status).toBe(403);
  });

  test('Customer cannot access Admin Staff management', async () => {
    const res = await request(app)
      .get('/api/admin/staff')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('Credential & Secret Sanitization', () => {
  test('Responses never expose passwordHash or resetTokenHash', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(meRes.status).toBe(200);
    const bodyStr = JSON.stringify(meRes.body);
    expect(bodyStr).not.toContain('passwordHash');
    expect(bodyStr).not.toContain('resetTokenHash');
    expect(bodyStr).not.toContain('secret_hash_value');

    const staffRes = await request(app)
      .get('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(staffRes.status).toBe(200);
    const staffStr = JSON.stringify(staffRes.body);
    expect(staffStr).not.toContain('passwordHash');
    expect(staffStr).not.toContain('resetTokenHash');
  });
});

describe('Security Headers & Hardening', () => {
  test('Helmet security headers are active on all responses', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options'] || res.headers['content-security-policy']).toBeDefined();
  });

  test('Unknown routes return standardized 404 error without stack traces', async () => {
    const res = await request(app).get('/api/non-existent-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.stack).toBeUndefined();
  });
});
