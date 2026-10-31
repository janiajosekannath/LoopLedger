/**
 * globalSetup.js – downloads the MongoMemoryServer binary once before tests.
 * This prevents per-test suite download races.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Pre-warm: create and stop a server so the binary is cached
  const server = await MongoMemoryServer.create({
    instance: { storageEngine: 'ephemeralForTest' },
  });
  await server.stop();
};
