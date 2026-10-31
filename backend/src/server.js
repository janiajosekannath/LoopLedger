require('dotenv').config();
const cron = require('node-cron');
const connectDB = require('./config/database');
const app = require('./app');
const { autoCloseSubscriptions } = require('./jobs/autoClose');
const { remindOverdue } = require('./jobs/paymentReminders');
const { runBilling } = require('./services/billingEngine');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  // 1. Daily auto-close cron at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily autoCloseSubscriptions check...');
    try {
      const result = await autoCloseSubscriptions();
      console.log(`[CRON] Auto-close finished. Checked: ${result.checked}, Closed: ${result.closed}`);
    } catch (err) {
      console.error('[CRON] Auto-close error:', err.message);
    }
  });

  // 2. Daily recurring billing run at 02:00
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running automated billing run at 02:00...');
    try {
      const result = await runBilling({ asOf: new Date(), dryRun: false, triggeredBy: 'cron' });
      console.log(`[CRON] Billing run complete. Invoices created: ${result.created}, Skipped: ${result.skipped}`);
    } catch (err) {
      console.error('[CRON] Billing run error:', err.message);
    }
  });

  // 3. Daily overdue invoice payment reminder / dunning at 09:00
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running daily payment reminder dunning job at 09:00...');
    try {
      const result = await remindOverdue({ asOf: new Date(), sentBy: 'cron' });
      console.log(`[CRON] Reminders sent: ${result.sent}, Scanned: ${result.scanned}`);
    } catch (err) {
      console.error('[CRON] Reminder error:', err.message);
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
