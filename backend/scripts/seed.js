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
  // Two with customer portal logins
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
  console.log('\n--- Seeding Users & Customers ---');

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
      // Update address if missing or update
      customer.address = c.address;
      await customer.save();
      console.log(`Customer updated: ${c.email}`);
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
