require('dotenv').config();
const mongoose = require('mongoose');

let _mongoServer = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/loopledger';

  try {
    // Attempt connecting to the configured MongoDB with 2s timeout
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.warn(`\n[Database] Could not connect to external MongoDB at ${uri} (${err.message}).`);
    console.log(`[Database] Initializing in-process MongoMemoryServer for instant zero-dependency execution...`);

    const { MongoMemoryServer } = require('mongodb-memory-server');
    _mongoServer = await MongoMemoryServer.create();
    const memUri = _mongoServer.getUri();

    const conn = await mongoose.connect(memUri);
    console.log(`[Database] In-memory MongoDB connected: ${conn.connection.host}`);

    // Automatically seed essential demo data if the in-memory database is empty
    const User = require('../models/User');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Database] Auto-seeding standard demo accounts and catalog...');
      const { runSeed } = require('../../scripts/seed');
      if (typeof runSeed === 'function') {
        await runSeed(false); // pass false to keep connection open
      }
    }

    return conn;
  }
};

module.exports = connectDB;
