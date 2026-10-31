require('dotenv').config();
const connectDB = require('./config/database');
const app = require('./app');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`LoopLedger backend running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
