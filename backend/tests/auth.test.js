const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

// Set test environment variables before app loads
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';

const app = require('../src/app');

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
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Auth - Password Rules', () => {
  test('8-character password fails (needs at least 9)', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Ab1@1234', // exactly 8 chars
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('9-character password with required chars passes', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Ab1@12345', // 9 chars
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('password without uppercase fails', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test2@example.com',
      password: 'ab1@12345',
    });
    expect(res.status).toBe(400);
  });

  test('password without special char fails', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test3@example.com',
      password: 'Ab112345678',
    });
    expect(res.status).toBe(400);
  });
});

describe('Auth - Duplicate Email', () => {
  test('duplicate email returns 409', async () => {
    const userData = { name: 'User', email: 'dup@example.com', password: 'Aa1@12345' };
    await request(app).post('/api/auth/signup').send(userData);
    const res = await request(app).post('/api/auth/signup').send(userData);
    expect(res.status).toBe(409);
  });
});

describe('Auth - Login & Protected Routes', () => {
  let staffToken;
  let customerToken;
  let adminToken;

  beforeEach(async () => {
    // Create admin via direct model
    const bcrypt = require('bcrypt');
    const User = require('../src/models/User');
    const jwt = require('jsonwebtoken');

    const adminHash = await bcrypt.hash('Admin@1234!', 12);
    const admin = await User.create({ name: 'Admin', email: 'admin@test.com', passwordHash: adminHash, role: 'admin' });
    adminToken = jwt.sign({ userId: admin._id, role: 'admin' }, process.env.JWT_SECRET);

    const staffHash = await bcrypt.hash('Staff@1234!', 12);
    const staff = await User.create({ name: 'Staff', email: 'staff@test.com', passwordHash: staffHash, role: 'staff' });
    staffToken = jwt.sign({ userId: staff._id, role: 'staff' }, process.env.JWT_SECRET);

    // Create customer via signup
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Customer', email: 'cust@test.com', password: 'Cust@1234!',
    });
    customerToken = res.body.data.token;
  });

  test('staff cannot create another staff', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'New Staff', email: 'newstaff@test.com', password: 'Staff@12345!' });
    expect(res.status).toBe(403);
  });

  test('customer is blocked from admin routes', async () => {
    const res = await request(app)
      .get('/api/admin/staff')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  test('unauthenticated request blocked', async () => {
    const res = await request(app).get('/api/admin/staff');
    expect(res.status).toBe(401);
  });

  test('admin can create staff', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Staff', email: 'newstaff2@test.com', password: 'Staff@12345!' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('staff');
  });
});

describe('Auth - Reset Token Single Use', () => {
  test('reset token is single use', async () => {
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    const User = require('../src/models/User');

    const hash = await bcrypt.hash('Old@12345!', 12);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await User.create({
      name: 'Reset Test',
      email: 'reset@test.com',
      passwordHash: hash,
      role: 'customer',
      resetTokenHash: tokenHash,
      resetExpires: new Date(Date.now() + 30 * 60 * 1000),
    });

    // First use succeeds
    const res1 = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'New@12345!' });
    expect(res1.status).toBe(200);

    // Second use fails — token is cleared
    const res2 = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'New2@12345!' });
    expect(res2.status).toBe(400);
  });
});

describe('Security - No password hash in response', () => {
  test('signup response does not include passwordHash', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test', email: 'hash@test.com', password: 'Aa1@12345',
    });
    expect(res.status).toBe(201);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('resetTokenHash');
  });

  test('login response does not include passwordHash', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Test', email: 'login@test.com', password: 'Aa1@12345',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com', password: 'Aa1@12345',
    });
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('resetTokenHash');
  });
});
