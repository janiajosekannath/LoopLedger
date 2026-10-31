/**
 * seed.js — Idempotent demo data seed for LoopLedger
 * Run: npm run seed (from backend directory)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const User = require('../src/models/User');
const Customer = require('../src/models/Customer');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/loopledger';

const DEMO_ADMIN = { email: 'admin@loopledger.dev', password: 'Admin@1234!', name: 'Super Admin', role: 'admin' };
const DEMO_STAFF = [
  { email: 'staff1@loopledger.dev', password: 'Staff@1234!', name: 'Priya Sharma', role: 'staff' },
  { email: 'staff2@loopledger.dev', password: 'Staff@5678!', name: 'Rohit Verma', role: 'staff' },
];
const DEMO_CUSTOMERS = [
  { name: 'Ananya Iyer', email: 'ananya@techvista.in', phone: '9876543210', company: 'TechVista Solutions' },
  { name: 'Karan Mehta', email: 'karan@nexagroup.com', phone: '9876543211', company: 'Nexa Group' },
  { name: 'Deepika Nair', email: 'deepika@softcraft.co', phone: '9876543212', company: 'SoftCraft Co' },
  { name: 'Vikram Rao', email: 'vikram@infraedge.in', phone: '9876543213', company: 'InfraEdge India' },
  { name: 'Sunita Pillai', email: 'sunita@databridge.io', phone: '9876543214', company: 'DataBridge IO' },
  { name: 'Arjun Kapoor', email: 'arjun@cloudplex.net', phone: '9876543215', company: 'CloudPlex Networks' },
  { name: 'Meera Joshi', email: 'meera@buildfast.in', phone: '9876543216', company: 'BuildFast India' },
  { name: 'Rajesh Kumar', email: 'rajesh@finedge.co', phone: '9876543217', company: 'FinEdge Capital' },
  // Two with customer portal logins
  { name: 'Pooja Singh', email: 'pooja@loopledger.dev', phone: '9876543218', company: 'Singh Enterprises', hasLogin: true, password: 'Customer@1234!' },
  { name: 'Amit Desai', email: 'amit@loopledger.dev', phone: '9876543219', company: 'Desai Technologies', hasLogin: true, password: 'Customer@5678!' },
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
    const existingCustomer = await Customer.findOne({ email: c.email });
    if (!existingCustomer) {
      const customer = await Customer.create({
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        address: {
          line1: '123 Business Park',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
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

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  await seedUsers();

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
  for (const c of DEMO_CUSTOMERS.filter(c => c.hasLogin)) {
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
