/**
 * tests/reminders.test.js
 * Tests for overdue invoice detection, ReminderLog creation, and email notifications.
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
const ReminderLog = require('../src/models/ReminderLog');
const { remindOverdue } = require('../src/jobs/paymentReminders');

let mongoServer;
let adminToken;
let customer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin_reminders@test.com',
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
    name: 'Wipro Technologies',
    email: 'accounts@wipro.com',
    company: 'Wipro Limited',
  });
});

afterEach(async () => {
  await ReminderLog.deleteMany({});
  await Invoice.deleteMany({});
  await Customer.deleteMany({});
});

describe('Phase 6: Payment Reminders & Dunning', () => {
  test('Creates ReminderLog entries and sends emails for overdue confirmed invoices', async () => {
    // 1. Overdue confirmed invoice (due 10 days ago)
    const overdueInvoice = await Invoice.create({
      number: 'INV-OVERDUE-01',
      customer: customer._id,
      issueDate: new Date(Date.now() - 25 * 86400000),
      dueDate: new Date(Date.now() - 10 * 86400000),
      total: 12000,
      amountPaid: 0,
      balance: 12000,
      status: 'confirmed',
    });

    // 2. Future confirmed invoice (due in 5 days) -> should NOT be reminded
    await Invoice.create({
      number: 'INV-FUTURE-01',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 5 * 86400000),
      total: 8000,
      amountPaid: 0,
      balance: 8000,
      status: 'confirmed',
    });

    // 3. Overdue but PAID invoice -> should NOT be reminded
    await Invoice.create({
      number: 'INV-PAID-01',
      customer: customer._id,
      issueDate: new Date(Date.now() - 20 * 86400000),
      dueDate: new Date(Date.now() - 5 * 86400000),
      total: 5000,
      amountPaid: 5000,
      balance: 0,
      status: 'paid',
    });

    // 4. Overdue DRAFT invoice -> should NOT be reminded (must be confirmed)
    await Invoice.create({
      number: 'INV-DRAFT-01',
      customer: customer._id,
      issueDate: new Date(Date.now() - 20 * 86400000),
      dueDate: new Date(Date.now() - 5 * 86400000),
      total: 3000,
      amountPaid: 0,
      balance: 3000,
      status: 'draft',
    });

    // Run the reminder job
    const result = await remindOverdue({ asOf: new Date() });

    expect(result.scanned).toBe(1);
    expect(result.sent).toBe(1);

    const logs = await ReminderLog.find({ invoice: overdueInvoice._id });
    expect(logs.length).toBe(1);
    expect(logs[0].recipient).toBe('accounts@wipro.com');
    expect(logs[0].channel).toBe('email');
    expect(logs[0].status).toBe('sent');
  });

  test('Admin endpoint GET /api/reminders lists sent reminder logs', async () => {
    const inv = await Invoice.create({
      number: 'INV-LOG-TEST',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() - 5 * 86400000),
      total: 1000,
      amountPaid: 0,
      balance: 1000,
      status: 'confirmed',
    });

    await ReminderLog.create({
      invoice: inv._id,
      customer: customer._id,
      channel: 'email',
      recipient: 'accounts@wipro.com',
      sentBy: 'system',
      status: 'sent',
    });

    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].invoice.number).toBe('INV-LOG-TEST');
  });
});
