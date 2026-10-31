require('dotenv').config();
const cron = require('node-cron');
const connectDB = require('./config/database');
const app = require('./app');
const { autoCloseSubscriptions } = require('./jobs/autoClose');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  // Register daily auto-close cron at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily autoCloseSubscriptions check...');
    try {
      const result = await autoCloseSubscriptions();
      console.log(`[CRON] Auto-close finished. Checked: ${result.checked}, Closed: ${result.closed}`);
    } catch (err) {
      console.error('[CRON] Auto-close error:', err.message);
    }
  });

  app.listen(PORT, () => {
    console.log(`LoopLedger backend running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
