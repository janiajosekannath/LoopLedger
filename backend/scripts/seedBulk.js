/**
 * seedBulk.js — High-Volume Realistic Data Generator for LoopLedger
 * Benchmark & Scale Testing (Target: 10,000 subscriptions)
 *
 * Usage:
 *   node scripts/seedBulk.js --subs 10000
 *   npm run seed:bulk
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Customer = require('../src/models/Customer');
const { Product, ProductVariant } = require('../src/models/Product');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const Tax = require('../src/models/Tax');
const Discount = require('../src/models/Discount');
const Subscription = require('../src/models/Subscription');
const Invoice = require('../src/models/Invoice');
const Payment = require('../src/models/Payment');
const { MrrChange, StatusHistory } = require('../src/models/History');
const { round2 } = require('../src/utils/money');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/loopledger';

// Parse CLI flags
function getArg(flag, defaultVal) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return defaultVal;
}

const TOTAL_SUBS = parseInt(getArg('--subs', '10000'), 10);
const BATCH_SIZE = 1000;

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Diya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Anika', 'Navya', 'Myra', 'Riya', 'Avani',
  'Rohan', 'Vikram', 'Pooja', 'Amit', 'Sunil', 'Neha', 'Rahul', 'Sneha', 'Gaurav', 'Meera'
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Gupta', 'Singh', 'Kumar', 'Mehta',
  'Joshi', 'Chopra', 'Rao', 'Bhat', 'Desai', 'Kulkarni', 'Malhotra', 'Menon', 'Pillai', 'Saxena'
];
const CITIES = [
  { city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
  { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
  { city: 'Delhi', state: 'Delhi', pincode: '110001' },
  { city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
  { city: 'Pune', state: 'Maharashtra', pincode: '411001' },
  { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
  { city: 'Gurgaon', state: 'Haryana', pincode: '122001' },
  { city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
];

const PAYMENT_METHODS = ['upi', 'card', 'bank_transfer', 'cash', 'other'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function runBulkSeed() {
  console.log(`\n======================================================`);
  console.log(`🚀 LoopLedger Bulk Seeder — Target: ${TOTAL_SUBS} Subscriptions`);
  console.log(`======================================================`);
  const startTime = Date.now();

  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB: ${MONGO_URI}`);

  // Fetch or ensure master catalog items
  let products = await Product.find({ archived: false }).lean();
  let plans = await SubscriptionPlan.find({ active: true }).lean();
  let taxes = await Tax.find({ active: true }).lean();

  if (products.length === 0 || plans.length === 0) {
    console.log(`Base catalog empty. Please run 'npm run seed' first to seed standard catalog.`);
    process.exit(1);
  }

  const defaultTax = taxes[0] || { percent: 18 };

  // 1. Generate Customers (1 customer per ~3 subscriptions => ~TOTAL_SUBS / 3 customers)
  const numCustomers = Math.max(100, Math.ceil(TOTAL_SUBS / 3));
  console.log(`\n1/5 Generating ${numCustomers} realistic Indian customers...`);

  const existingCustomerCount = await Customer.countDocuments();
  const customerDocs = [];

  for (let i = 0; i < numCustomers; i++) {
    const fn = randomChoice(FIRST_NAMES);
    const ln = randomChoice(LAST_NAMES);
    const loc = randomChoice(CITIES);
    const custNum = existingCustomerCount + i + 1;

    customerDocs.push({
      name: `${fn} ${ln}`,
      email: `bulk.cust.${custNum}@company-${custNum}.in`,
      phone: `+91 ${randomInt(70000, 99999)} ${randomInt(10000, 99999)}`,
      company: `${ln} Innovations & Tech Pvt Ltd`,
      address: {
        line1: `Plot ${randomInt(1, 999)}, Tech Park Phase ${randomInt(1, 5)}`,
        city: loc.city,
        state: loc.state,
        pincode: loc.pincode,
        country: 'India',
      },
      registeredAt: new Date(Date.now() - randomInt(30, 365) * 86400000),
    });
  }

  for (let i = 0; i < customerDocs.length; i += BATCH_SIZE) {
    const chunk = customerDocs.slice(i, i + BATCH_SIZE);
    await Customer.insertMany(chunk, { ordered: false });
  }

  const seededCustomers = await Customer.find({ email: /^bulk\.cust\./ }, '_id name email').lean();
  console.log(`✓ Inserted ${seededCustomers.length} bulk customers.`);

  // 2. Generate Subscriptions in realistic status mixes:
  // ~60% active, ~15% paused, ~15% closed, ~5% confirmed, ~5% draft
  console.log(`\n2/5 Generating ${TOTAL_SUBS} subscriptions across plans with MRR...`);

  const now = new Date();
  const subscriptionDocs = [];
  const mrrChangeDocs = [];

  const existingSubCount = await Subscription.countDocuments();

  for (let i = 0; i < TOTAL_SUBS; i++) {
    const subIndex = existingSubCount + i + 1;
    const subNumber = `SUB-${String(subIndex).padStart(6, '0')}`;
    const customer = randomChoice(seededCustomers);
    const plan = randomChoice(plans);
    const product = products.find((p) => String(p._id) === String(plan.product)) || products[0];

    // Status distribution
    const roll = Math.random();
    let status = 'active';
    if (roll < 0.60) status = 'active';
    else if (roll < 0.75) status = 'paused';
    else if (roll < 0.90) status = 'closed';
    else if (roll < 0.95) status = 'confirmed';
    else status = 'draft';

    const qty = randomInt(plan.minQty || 1, 15);
    const unitPrice = round2(product.salesPrice || 1000);
    const lineAmount = round2(unitPrice * qty);
    const taxRate = defaultTax.percent || 18;
    const taxAmount = round2((lineAmount * taxRate) / 100);
    const totalAmount = round2(lineAmount + taxAmount);

    // Dates
    const daysAgo = randomInt(15, 300);
    const startDate = new Date(now.getTime() - daysAgo * 86400000);
    const expiryDate = new Date(startDate.getTime() + 365 * 86400000);

    let nextBillingDate = null;
    let pausedAt = null;
    let closedAt = null;

    if (status === 'active') {
      // Some nextBillingDate in the past to demonstrate overdue & ready billing
      const daysUntilBill = randomInt(-10, 25);
      nextBillingDate = new Date(now.getTime() + daysUntilBill * 86400000);
    } else if (status === 'paused') {
      pausedAt = new Date(now.getTime() - randomInt(1, 30) * 86400000);
    } else if (status === 'closed') {
      closedAt = new Date(now.getTime() - randomInt(1, 60) * 86400000);
    }

    const subId = new mongoose.Types.ObjectId();

    subscriptionDocs.push({
      _id: subId,
      number: subNumber,
      customer: customer._id,
      plan: plan._id,
      startDate,
      expiryDate,
      paymentTerms: randomChoice(['immediate', 'net15', 'net30']),
      lines: [
        {
          product: product._id,
          description: `${product.name} (${plan.name})`,
          quantity: qty,
          unitPrice,
          tax: defaultTax._id,
          taxAmount,
          discountAmount: 0,
          amount: totalAmount,
        },
      ],
      totals: {
        subtotal: lineAmount,
        discountTotal: 0,
        taxTotal: taxAmount,
        total: totalAmount,
      },
      status,
      nextBillingDate,
      pausedAt,
      closedAt,
      createdAt: startDate,
      updatedAt: now,
    });

    // Compute normalized MRR
    let mrr = lineAmount;
    if (plan.billingPeriod === 'daily') mrr = lineAmount * 30;
    else if (plan.billingPeriod === 'weekly') mrr = (lineAmount * 52) / 12;
    else if (plan.billingPeriod === 'yearly') mrr = lineAmount / 12;
    mrr = round2(mrr);

    if (status === 'active' || status === 'paused') {
      mrrChangeDocs.push({
        subscription: subId,
        at: startDate,
        type: 'new',
        amount: mrr,
        createdAt: startDate,
      });
    } else if (status === 'closed') {
      mrrChangeDocs.push({
        subscription: subId,
        at: startDate,
        type: 'new',
        amount: mrr,
        createdAt: startDate,
      });
      mrrChangeDocs.push({
        subscription: subId,
        at: closedAt || now,
        type: 'churn',
        amount: -mrr,
        createdAt: closedAt || now,
      });
    }
  }

  // Insert subscriptions in batches
  for (let i = 0; i < subscriptionDocs.length; i += BATCH_SIZE) {
    const chunk = subscriptionDocs.slice(i, i + BATCH_SIZE);
    await Subscription.insertMany(chunk, { ordered: false });
    process.stdout.write(`  Inserted ${Math.min(i + BATCH_SIZE, subscriptionDocs.length)}/${subscriptionDocs.length} subscriptions...\r`);
  }
  console.log(`\n✓ Inserted ${subscriptionDocs.length} subscriptions.`);

  // Insert MRR Changes
  for (let i = 0; i < mrrChangeDocs.length; i += BATCH_SIZE) {
    const chunk = mrrChangeDocs.slice(i, i + BATCH_SIZE);
    await MrrChange.insertMany(chunk, { ordered: false });
  }
  console.log(`✓ Inserted ${mrrChangeDocs.length} MrrChange records.`);

  // 3. Generate Invoices (~1.5 invoices per subscription)
  // Categories: paid, confirmed (some overdue), draft
  console.log(`\n3/5 Generating invoices across draft, confirmed, paid, and overdue buckets...`);

  const existingInvCount = await Invoice.countDocuments();
  const invoiceDocs = [];
  const paymentDocs = [];

  let invCounter = existingInvCount;

  // Sample a subset of active & closed subscriptions to have invoices
  const subSubset = subscriptionDocs.filter((s) => s.status !== 'draft');

  for (let s of subSubset) {
    invCounter++;
    const invNumber = `INV-${String(invCounter).padStart(6, '0')}`;
    const total = s.totals.total;

    // Distribute invoice states
    const roll = Math.random();
    let invStatus = 'paid';
    let amountPaid = total;
    let balance = 0;
    let dueDate = new Date(now.getTime() + 15 * 86400000);
    const issueDate = new Date(s.startDate.getTime() + 5 * 86400000);

    if (roll < 0.50) {
      // Paid
      invStatus = 'paid';
      amountPaid = total;
      balance = 0;
      dueDate = new Date(issueDate.getTime() + 15 * 86400000);
    } else if (roll < 0.80) {
      // Confirmed & Overdue
      invStatus = 'confirmed';
      const daysOverdue = randomInt(5, 75);
      dueDate = new Date(now.getTime() - daysOverdue * 86400000);
      amountPaid = roll < 0.65 ? 0 : round2(total * 0.3); // some partial
      balance = round2(total - amountPaid);
    } else if (roll < 0.95) {
      // Confirmed & Current
      invStatus = 'confirmed';
      dueDate = new Date(now.getTime() + randomInt(5, 20) * 86400000);
      amountPaid = 0;
      balance = total;
    } else {
      // Draft
      invStatus = 'draft';
      amountPaid = 0;
      balance = total;
    }

    const invId = new mongoose.Types.ObjectId();

    invoiceDocs.push({
      _id: invId,
      number: invNumber,
      customer: s.customer,
      subscription: s._id,
      billingPeriodStart: s.startDate,
      billingPeriodEnd: new Date(s.startDate.getTime() + 30 * 86400000),
      issueDate,
      dueDate,
      lines: s.lines,
      subtotal: s.totals.subtotal,
      discountTotal: 0,
      taxTotal: s.totals.taxTotal,
      total,
      amountPaid,
      balance,
      status: invStatus,
      sentAt: invStatus !== 'draft' ? issueDate : null,
      createdAt: issueDate,
      updatedAt: now,
    });

    // 4. Generate Payments for paid/partial invoices
    if (amountPaid > 0) {
      paymentDocs.push({
        number: `PAY-${String(invCounter).padStart(6, '0')}`,
        customer: s.customer,
        invoice: invId,
        method: randomChoice(PAYMENT_METHODS),
        amount: amountPaid,
        paidOn: new Date(issueDate.getTime() + randomInt(1, 10) * 86400000),
        note: `Bulk settlement for ${invNumber}`,
        recordedBy: 'admin',
        createdAt: issueDate,
      });
    }
  }

  // Insert Invoices in batches
  for (let i = 0; i < invoiceDocs.length; i += BATCH_SIZE) {
    const chunk = invoiceDocs.slice(i, i + BATCH_SIZE);
    await Invoice.insertMany(chunk, { ordered: false });
    process.stdout.write(`  Inserted ${Math.min(i + BATCH_SIZE, invoiceDocs.length)}/${invoiceDocs.length} invoices...\r`);
  }
  console.log(`\n✓ Inserted ${invoiceDocs.length} invoices.`);

  // Insert Payments in batches
  console.log(`\n4/5 Inserting ${paymentDocs.length} payments across all methods...`);
  for (let i = 0; i < paymentDocs.length; i += BATCH_SIZE) {
    const chunk = paymentDocs.slice(i, i + BATCH_SIZE);
    await Payment.insertMany(chunk, { ordered: false });
  }
  console.log(`✓ Inserted ${paymentDocs.length} payment records.`);

  // 5. Verification & Summary
  console.log(`\n5/5 Database Index and Volume Verification:`);
  const finalSubs = await Subscription.countDocuments();
  const finalInvs = await Invoice.countDocuments();
  const finalPays = await Payment.countDocuments();
  const finalCust = await Customer.countDocuments();

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`------------------------------------------------------`);
  console.log(`✅ Bulk Seeding Completed in ${elapsedSec}s!`);
  console.log(`Total Subscriptions: ${finalSubs.toLocaleString()}`);
  console.log(`Total Invoices:      ${finalInvs.toLocaleString()}`);
  console.log(`Total Payments:      ${finalPays.toLocaleString()}`);
  console.log(`Total Customers:     ${finalCust.toLocaleString()}`);
  console.log(`------------------------------------------------------\n`);

  await mongoose.disconnect();
}

runBulkSeed().catch((err) => {
  console.error('Bulk seeding failed:', err);
  process.exit(1);
});
