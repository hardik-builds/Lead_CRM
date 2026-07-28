import { checkAndSendReminders } from './reminderService';

let cronInitialized = false;

export function initReminderCron() {
  if (cronInitialized) return;
  cronInitialized = true;

  console.log('🤖 [Autonomous Background Cron Engine]: Initialized! Scanning lead follow-ups & meetings automatically in the background...');

  // 1. Initial Immediate Autonomous Background Scan on Server Start
  setTimeout(async () => {
    try {
      console.log('🤖 [Background Cron]: Running automatic lead reminder scan...');
      await checkAndSendReminders();
    } catch (err) {
      console.error('[Background Cron Error]:', err.message);
    }
  }, 5000);

  // 2. Recurring Autonomous Background Scan (Every 30 Minutes)
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('🤖 [Background Cron 30-Min Interval]: Running automatic 2-day & 1-day reminder scan...');
      await checkAndSendReminders();
    } catch (err) {
      console.error('[Background Cron Interval Error]:', err.message);
    }
  }, THIRTY_MINUTES_MS);
}
