import { checkAndSendReminders } from './reminderService';

let cronInitialized = false;

export function initReminderCron() {
  if (cronInitialized) return;
  cronInitialized = true;

  console.log('🤖 [60-Minute Background Cron Engine]: Initialized! Will scan for new lead reminders every 60 minutes with 100% Zero-Spam lock...');

  // 1. Initial Startup Scan 10 Seconds After Boot
  setTimeout(async () => {
    try {
      console.log('🤖 [60-Min Cron Engine]: Running startup lead reminder scan...');
      await checkAndSendReminders();
    } catch (err) {
      console.error('[60-Min Cron Error]:', err.message);
    }
  }, 10000);

  // 2. Recurring 60-Minute Background Scan (1 Hour Interval)
  const ONE_HOUR_MS = 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('🤖 [60-Min Cron Interval]: Running hourly lead reminder check...');
      await checkAndSendReminders();
    } catch (err) {
      console.error('[60-Min Cron Interval Error]:', err.message);
    }
  }, ONE_HOUR_MS);
}
