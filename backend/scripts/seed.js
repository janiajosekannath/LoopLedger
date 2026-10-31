/**
 * seed.js — Idempotent demo data seed for LoopLedger
 * Run: npm run seed (from backend directory)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const User = require('../src/models/User');
const Customer = require('../src/models/Customer');
const Tax = require('../src/models/Tax');
const { Product, ProductVariant } = require('../src/models/Product');
const SubscriptionPlan = require('../src/models/SubscriptionPlan');
const Discount = require('../src/models/Discount');
const QuotationTemplate = require('../src/models/QuotationTemplate');
const Quotation = require('../src/models/Quotation');
const Subscription = require('../src/models/Subscription');
const Invoice = require('../src/models/Invoice');
const Payment = require('../src/models/Payment');
const { StatusHistory, MrrChange } = require('../src/models/History');
const { nextSequence } = require('../src/utils/sequence');
const { quote } = require('../src/services/pricingEngine');
const { calculateMrr } = require('../src/services/mrr');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/loopledger';

const DEMO_ADMIN = { email: 'admin@loopledger.dev', password: 'Admin@1234!', name: 'Super Admin', role: 'admin' };
const DEMO_STAFF = [
  { email: 'staff1@loopledger.dev', password: 'Staff@1234!', name: 'Priya Sharma', role: 'staff' },
  { email: 'staff2@loopledger.dev', password: 'Staff@5678!', name: 'Rohit Verma', role: 'staff' },
];
const DEMO_CUSTOMERS = [
  {
    name: 'Ananya Iyer',
    email: 'ananya@techvista.in',
    phone: '+91 98765 43210',
    company: 'TechVista Solutions Pvt Ltd',
    address: { line1: '14 Indiranagar 100ft Road', city: 'Bangalore', state: 'Karnataka', pincode: '560038', country: 'India' },
  },
  {
    name: 'Karan Mehta',
    email: 'karan@nexagroup.com',
    phone: '+91 98765 43211',
    company: 'Nexa Group India',
    address: { line1: '45 Nariman Point', city: 'Mumbai', state: 'Maharashtra', pincode: '400021', country: 'India' },
  },
  {
    name: 'Deepika Nair',
    email: 'deepika@softcraft.co',
    phone: '+91 98765 43212',
    company: 'SoftCraft Technologies',
    address: { line1: 'Sector 62 Phase 8', city: 'Gurgaon', state: 'Haryana', pincode: '122002', country: 'India' },
  },
  {
    name: 'Vikram Rao',
    email: 'vikram@infraedge.in',
    phone: '+91 98765 43213',
    company: 'InfraEdge Networks',
    address: { line1: 'Plot 21 HITEC City', city: 'Hyderabad', state: 'Telangana', pincode: '500081', country: 'India' },
  },
  {
    name: 'Sunita Pillai',
    email: 'sunita@databridge.io',
    phone: '+91 98765 43214',
    company: 'DataBridge Analytics',
    address: { line1: 'Old Mahabalipuram Rd Taramani', city: 'Chennai', state: 'Tamil Nadu', pincode: '600113', country: 'India' },
  },
  {
    name: 'Arjun Kapoor',
    email: 'arjun@cloudplex.net',
    phone: '+91 98765 43215',
    company: 'CloudPlex Infrastructure',
    address: { line1: 'Viman Nagar IT Park', city: 'Pune', state: 'Maharashtra', pincode: '411014', country: 'India' },
  },
  {
    name: 'Meera Joshi',
    email: 'meera@buildfast.in',
    phone: '+91 98765 43216',
    company: 'BuildFast SaaS',
    address: { line1: 'SG Highway Bodakdev', city: 'Ahmedabad', state: 'Gujarat', pincode: '380054', country: 'India' },
  },
  {
    name: 'Rajesh Kumar',
    email: 'rajesh@finedge.co',
    phone: '+91 98765 43217',
    company: 'FinEdge Capital Partners',
    address: { line1: 'Barakhamba Road Connaught Place', city: 'New Delhi', state: 'Delhi', pincode: '110001', country: 'India' },
  },
  {
    name: 'Pooja Singh',
    email: 'pooja@loopledger.dev',
    phone: '+91 98765 43218',
    company: 'Singh Enterprises',
    address: { line1: 'MI Road Civil Lines', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', country: 'India' },
    hasLogin: true,
    password: 'Customer@1234!',
  },
  {
    name: 'Amit Desai',
    email: 'amit@loopledger.dev',
    phone: '+91 98765 43219',
    company: 'Desai Technologies',
    address: { line1: 'Kalyani Nagar', city: 'Pune', state: 'Maharashtra', pincode: '411006', country: 'India' },
    hasLogin: true,
    password: 'Customer@5678!',
  },
];

async function seedUsers() {
  console.log('\n--- Seeding Users ---');

  // Admin
  const existingAdmin = await User.findOne({ email: DEMO_ADMIN.email });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(DEMO_ADMIN.password, 12);
    await User.create({ name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, passwordHash, role: 'admin' });
    console.log(`Created admin: ${DEMO_ADMIN.email}`);
  } else {
    console.log(`Admin already exists: ${DEMO_ADMIN.email}`);
  }

  // Staff
  for (const s of DEMO_STAFF) {
    const existing = await User.findOne({ email: s.email });
    if (!existing) {
      const passwordHash = await bcrypt.hash(s.password, 12);
      await User.create({ name: s.name, email: s.email, passwordHash, role: 'staff' });
      console.log(`Created staff: ${s.email}`);
    } else {
      console.log(`Staff already exists: ${s.email}`);
    }
  }

  // Customers
  for (const c of DEMO_CUSTOMERS) {
    let customer = await Customer.findOne({ email: c.email });
    if (!customer) {
      customer = await Customer.create({
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        address: c.address,
      });

      if (c.hasLogin) {
        const passwordHash = await bcrypt.hash(c.password, 12);
        const user = await User.create({
          name: c.name,
          email: c.email,
          passwordHash,
          role: 'customer',
          customer: customer._id,
        });
        customer.user = user._id;
        await customer.save();
        console.log(`Created customer with login: ${c.email}`);
      } else {
        console.log(`Created customer: ${c.email}`);
      }
    } else {
      console.log(`Customer already exists: ${c.email}`);
    }
  }
}

async function seedCatalog() {
  console.log('\n--- Seeding Taxes, Products, Plans, and Discounts ---');

  // Taxes
  const taxRates = [
    { name: 'GST 18%', percent: 18, description: 'Standard GST on IT & Cloud services' },
    { name: 'GST 5%', percent: 5, description: 'Concessional GST rate' },
    { name: 'Exempt 0%', percent: 0, description: 'Exempted or zero-rated services' },
  ];

  const taxesMap = {};
  for (const t of taxRates) {
    let tax = await Tax.findOne({ name: t.name });
    if (!tax) {
      tax = await Tax.create(t);
      console.log(`Created tax: ${t.name} (${t.percent}%)`);
    } else {
      tax.percent = t.percent;
      tax.description = t.description;
      await tax.save();
      console.log(`Tax updated: ${t.name}`);
    }
    taxesMap[t.name] = tax._id;
  }

  // Products and Variants
  const productsData = [
    {
      name: 'Business Software Suite',
      type: 'subscription',
      salesPrice: 1000,
      costPrice: 400,
      notes: 'Flagship enterprise ERP and CRM package',
      taxName: 'GST 18%',
      variants: [
        { attribute: 'Brand', value: 'Standard Edition', extraPrice: 0 },
        { attribute: 'Brand', value: 'Odoo Edition', extraPrice: 560 }, // Test case: ₹1,000 + ₹560 = ₹1,560
        { attribute: 'Tier', value: 'Multi-Company Add-on', extraPrice: 350 },
      ],
    },
    {
      name: 'Cloud Dedicated Database',
      type: 'service',
      salesPrice: 3500,
      costPrice: 1500,
      notes: 'High-availability PostgreSQL/MongoDB replica set',
      taxName: 'GST 18%',
      variants: [
        { attribute: 'Storage', value: '50GB NVMe', extraPrice: 0 },
        { attribute: 'Storage', value: '250GB NVMe', extraPrice: 1200 },
        { attribute: 'Storage', value: '1TB NVMe', extraPrice: 3800 },
      ],
    },
    {
      name: 'User License Seat',
      type: 'subscription',
      salesPrice: 450,
      costPrice: 100,
      notes: 'Per-seat user license with role-based permissions',
      taxName: 'GST 18%',
      variants: [
        { attribute: 'Role', value: 'Standard User', extraPrice: 0 },
        { attribute: 'Role', value: 'Power Analyst', extraPrice: 200 },
      ],
    },
    {
      name: 'Premium 24x7 Support SLA',
      type: 'service',
      salesPrice: 2000,
      costPrice: 600,
      notes: 'Guaranteed 15-minute response time and dedicated TAM',
      taxName: 'GST 18%',
      variants: [],
    },
    {
      name: 'Hardware Security Key (FIDO2)',
      type: 'physical',
      salesPrice: 1200,
      costPrice: 600,
      notes: 'Dual USB-A/NFC hardware authenticator token',
      taxName: 'GST 5%',
      variants: [
        { attribute: 'Connector', value: 'Type-C', extraPrice: 150 },
        { attribute: 'Connector', value: 'Type-A', extraPrice: 0 },
      ],
    },
  ];

  const productsMap = {};
  for (const p of productsData) {
    let product = await Product.findOne({ name: p.name });
    if (!product) {
      product = await Product.create({
        name: p.name,
        type: p.type,
        salesPrice: p.salesPrice,
        costPrice: p.costPrice,
        notes: p.notes,
        tax: taxesMap[p.taxName],
      });
      console.log(`Created product: ${p.name}`);
    } else {
      product.salesPrice = p.salesPrice;
      product.costPrice = p.costPrice;
      product.tax = taxesMap[p.taxName];
      await product.save();
      console.log(`Product updated: ${p.name}`);
    }
    productsMap[p.name] = product._id;

    for (const v of p.variants) {
      let variant = await ProductVariant.findOne({
        product: product._id,
        attribute: v.attribute,
        value: v.value,
      });
      if (!variant) {
        await ProductVariant.create({
          product: product._id,
          attribute: v.attribute,
          value: v.value,
          extraPrice: v.extraPrice,
        });
        console.log(`  Added variant: ${v.attribute}=${v.value} (+₹${v.extraPrice})`);
      }
    }
  }

  // Subscription Plans
  const plansData = [
    {
      name: 'Startup Daily Sandbox',
      productName: 'Cloud Dedicated Database',
      price: 250,
      billingPeriod: 'daily',
      minQty: 1,
      allowPause: true,
      allowEarlyClose: true,
      allowRenew: true,
      autoClose: false,
    },
    {
      name: 'Growth Weekly Sprint',
      productName: 'User License Seat',
      price: 1500,
      billingPeriod: 'weekly',
      minQty: 2,
      allowPause: false, // Disallowed pause
      allowEarlyClose: true,
      allowRenew: true,
      autoClose: true, // Auto close on expiry
    },
    {
      name: 'Enterprise Monthly Scale',
      productName: 'Business Software Suite',
      price: 5000,
      billingPeriod: 'monthly',
      minQty: 1,
      allowPause: true,
      allowEarlyClose: true,
      allowRenew: true,
      autoClose: false,
    },
    {
      name: 'Corporate Annual Suite',
      productName: 'Business Software Suite',
      price: 54000,
      billingPeriod: 'yearly',
      minQty: 1,
      allowPause: true,
      allowEarlyClose: false, // Locked annual contract
      allowRenew: true,
      autoClose: false,
    },
  ];

  const plansMap = {};
  for (const pl of plansData) {
    let plan = await SubscriptionPlan.findOne({ name: pl.name });
    const payload = {
      name: pl.name,
      product: productsMap[pl.productName],
      price: pl.price,
      billingPeriod: pl.billingPeriod,
      minQty: pl.minQty,
      allowPause: pl.allowPause,
      allowEarlyClose: pl.allowEarlyClose,
      allowRenew: pl.allowRenew,
      autoClose: pl.autoClose,
      active: true,
    };

    if (!plan) {
      plan = await SubscriptionPlan.create(payload);
      console.log(`Created plan: ${pl.name} (${pl.billingPeriod})`);
    } else {
      Object.assign(plan, payload);
      await plan.save();
      console.log(`Plan updated: ${pl.name}`);
    }
    plansMap[pl.name] = plan._id;
  }

  // Discounts
  const discountsData = [
    {
      name: '10% at 10+ seats',
      type: 'percent',
      value: 10,
      minQty: 10,
      scope: 'product',
      products: [productsMap['User License Seat']],
      active: true,
      timesUsed: 0,
    },
    {
      name: '₹500 off orders above ₹5,000',
      type: 'fixed',
      value: 500,
      minPurchase: 5000,
      scope: 'subscription',
      active: true,
      timesUsed: 0,
    },
    {
      name: 'Expired Festive Offer 2025',
      type: 'percent',
      value: 15,
      minPurchase: 1000,
      startDate: new Date('2025-10-01'),
      endDate: new Date('2025-12-31'),
      scope: 'subscription',
      active: true,
      timesUsed: 12,
    },
    {
      name: 'Exhausted Early Adopter',
      type: 'fixed',
      value: 200,
      usageLimit: 5,
      timesUsed: 5,
      scope: 'subscription',
      active: true,
    },
    {
      name: 'Scheduled New Year 2027',
      type: 'percent',
      value: 20,
      startDate: new Date('2027-01-01'),
      endDate: new Date('2027-01-31'),
      scope: 'subscription',
      active: true,
      timesUsed: 0,
    },
  ];

  for (const d of discountsData) {
    let disc = await Discount.findOne({ name: d.name });
    if (!disc) {
      await Discount.create(d);
      console.log(`Created discount: ${d.name} (${d.type === 'percent' ? d.value + '%' : '₹' + d.value})`);
    } else {
      Object.assign(disc, d);
      await disc.save();
      console.log(`Discount updated: ${d.name}`);
    }
  }

  return { taxesMap, productsMap, plansMap };
}

async function seedSales({ productsMap, plansMap }) {
  console.log('\n--- Seeding Quotation Templates, Quotations, and Subscriptions ---');

  const admin = await User.findOne({ email: DEMO_ADMIN.email });
  const customers = await Customer.find().lean();
  const allProducts = await Product.find().lean();
  const allPlans = await SubscriptionPlan.find().lean();
  const odooVariant = await ProductVariant.findOne({ value: 'Odoo Edition' });

  // 1. Quotation Templates
  const templatesData = [
    {
      name: 'Starter SaaS Package',
      validityDays: 30,
      planName: 'Enterprise Monthly Scale',
      productName: 'Business Software Suite',
      qty: 1,
    },
    {
      name: 'Team High-Growth Suite (15 Seats)',
      validityDays: 45,
      planName: 'Growth Weekly Sprint',
      productName: 'User License Seat',
      qty: 15,
    },
    {
      name: 'Corporate Annual Infrastructure',
      validityDays: 60,
      planName: 'Corporate Annual Suite',
      productName: 'Business Software Suite',
      qty: 1,
      variantId: odooVariant?._id,
    },
  ];

  const templateDocs = [];
  for (const t of templatesData) {
    let tmpl = await QuotationTemplate.findOne({ name: t.name });
    const planId = plansMap[t.planName];
    const prodId = productsMap[t.productName];

    if (!tmpl) {
      tmpl = await QuotationTemplate.create({
        name: t.name,
        validityDays: t.validityDays,
        plan: planId,
        lines: [
          {
            product: prodId,
            variant: t.variantId || undefined,
            quantity: t.qty,
          },
        ],
      });
      console.log(`Created template: ${t.name}`);
    }
    templateDocs.push(tmpl);
  }

  // 2. Quotations (Varied statuses: draft, quotation, confirmed, expired)
  console.log('Seeding demo quotations...');
  const existingQuotesCount = await Quotation.countDocuments();
  if (existingQuotesCount < 10) {
    const statuses = ['draft', 'quotation', 'confirmed'];
    for (let i = 0; i < 12; i++) {
      const cust = customers[i % customers.length];
      const plan = allPlans[i % allPlans.length];
      const prod = allProducts[i % allProducts.length];
      const status = statuses[i % statuses.length];
      const isExpired = i === 2; // Make one quotation explicitly expired for verification

      const validUntil = isExpired
        ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + (15 + i * 5) * 24 * 60 * 60 * 1000);

      const qty = Math.max(plan.minQty || 1, 1 + (i % 5));
      const pricing = await quote({
        lines: [{ product: prod._id.toString(), quantity: qty }],
        planId: plan._id.toString(),
        customerId: cust._id.toString(),
      });

      const number = await nextSequence('QUO');
      const quo = await Quotation.create({
        number,
        customer: cust._id,
        plan: plan._id,
        template: templateDocs[i % templateDocs.length]._id,
        lines: pricing.lines,
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        taxTotal: pricing.taxTotal,
        total: pricing.total,
        validUntil,
        status,
        createdBy: admin._id,
      });

      await StatusHistory.create({
        entityType: 'quotation',
        entityId: quo._id,
        to: status,
        changedBy: admin._id,
        note: `Initial seed state: ${status}`,
        at: new Date(Date.now() - (12 - i) * 3 * 24 * 60 * 60 * 1000),
      });
    }
    console.log('Seeded 12 demo quotations');
  }

  // 3. Subscriptions (at least 25 subscriptions spread over 6 months)
  console.log('Seeding demo subscriptions (at least 25 entries)...');
  const existingSubsCount = await Subscription.countDocuments();
  if (existingSubsCount < 25) {
    const subStatuses = ['active', 'active', 'active', 'paused', 'closed'];

    for (let i = 0; i < 28; i++) {
      const cust = customers[i % customers.length];
      const plan = allPlans[i % allPlans.length];
      const prod = allProducts[i % allProducts.length];
      const status = subStatuses[i % subStatuses.length];

      // Spread start dates over the past 6 months (180 days)
      const daysAgo = Math.floor((28 - i) * 6);
      const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const expiryDate = new Date(startDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      // Some nextBillingDate in the past for Time Machine catch-up test
      let nextBillingDate = new Date(startDate);
      if (status === 'active') {
        if (i % 3 === 0) {
          // In past! Due for billing
          nextBillingDate = new Date(Date.now() - (i + 1) * 2 * 24 * 60 * 60 * 1000);
        } else {
          nextBillingDate = new Date(Date.now() + (i + 5) * 24 * 60 * 60 * 1000);
        }
      }

      const qty = Math.max(plan.minQty || 1, 1 + (i % 4));
      const pricing = await quote({
        lines: [{ product: prod._id.toString(), quantity: qty }],
        planId: plan._id.toString(),
        customerId: cust._id.toString(),
      });

      const number = await nextSequence('SUB');
      const sub = await Subscription.create({
        number,
        customer: cust._id,
        plan: plan._id,
        startDate,
        expiryDate,
        paymentTerms: i % 2 === 0 ? 'immediate' : 'net30',
        lines: pricing.lines,
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        taxTotal: pricing.taxTotal,
        total: pricing.total,
        status,
        nextBillingDate: status === 'active' ? nextBillingDate : undefined,
        pausedAt: status === 'paused' ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : undefined,
        closedAt: status === 'closed' ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) : undefined,
      });

      // Status history
      await StatusHistory.create({
        entityType: 'subscription',
        entityId: sub._id,
        from: 'confirmed',
        to: status,
        changedBy: admin._id,
        at: startDate,
        note: `Contract initial setup: ${status}`,
      });

      // MrrChange spread over 6 months
      const mrr = calculateMrr(sub);
      await MrrChange.create({
        subscription: sub._id,
        type: 'new',
        amount: mrr,
        at: startDate,
      });

      if (status === 'closed') {
        await MrrChange.create({
          subscription: sub._id,
          type: 'churn',
          amount: mrr,
          at: sub.closedAt,
        });
      }
    }
    console.log('Seeded 28 demo subscriptions with historical MRR changes');
  }

  // 4. Sample Invoices and Payments for demo
  const sampleCust = customers[0];
  const sampleInv = await Invoice.findOne({ number: 'INV-DEMO-001' });
  if (!sampleInv && sampleCust) {
    const inv = await Invoice.create({
      number: 'INV-DEMO-001',
      customer: sampleCust._id,
      issueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      subtotal: 5000,
      discountTotal: 0,
      taxTotal: 900,
      total: 5900,
      amountPaid: 2000,
      balance: 3900,
      status: 'confirmed',
    });

    const payNumber = await nextSequence('PAY');
    await Payment.create({
      number: payNumber,
      customer: sampleCust._id,
      invoice: inv._id,
      method: 'bank_transfer',
      amount: 2000,
      paidOn: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      note: 'Demo initial installment',
      recordedBy: admin._id,
    });
    console.log('Seeded sample invoice INV-DEMO-001 with partial payment');
  }
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  await seedUsers();
  const catalog = await seedCatalog();
  await seedSales(catalog);

  console.log('\n========================================');
  console.log('DEMO CREDENTIALS');
  console.log('========================================');
  console.log('\nAdmin:');
  console.log(`  Email: ${DEMO_ADMIN.email}`);
  console.log(`  Password: ${DEMO_ADMIN.password}`);
  console.log('\nStaff:');
  for (const s of DEMO_STAFF) {
    console.log(`  Email: ${s.email}  Password: ${s.password}  Name: ${s.name}`);
  }
  console.log('\nCustomers with portal login:');
  for (const c of DEMO_CUSTOMERS.filter((c) => c.hasLogin)) {
    console.log(`  Email: ${c.email}  Password: ${c.password}  Name: ${c.name}`);
  }
  console.log('========================================\n');

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
