import dbConnect from '../../../lib/dbConnect';
import Reminder from '../../../models/Reminder';
import Lead from '../../../models/Lead';
import { istToUTC, sendReminderEmail, buildReminderEmailHTML } from '../../../lib/reminderService';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const { status } = req.query;
      const filter = status ? { status } : {};
      const reminders = await Reminder.find(filter).sort({ triggerAtUTC: 1 }).lean();
      return res.status(200).json({ success: true, reminders });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { leadId, company, reminderMessage, reminderDateIST, reminderTimeIST, recipientEmail, createdBy } = req.body;

      if (!leadId || !reminderMessage || !reminderDateIST || !reminderTimeIST || !recipientEmail) {
        return res.status(400).json({ success: false, error: 'Missing required fields: leadId, reminderMessage, reminderDateIST, reminderTimeIST, recipientEmail' });
      }

      // Convert IST date + time to UTC for cron matching
      const triggerAtUTC = istToUTC(reminderDateIST, reminderTimeIST);
      if (!triggerAtUTC || isNaN(triggerAtUTC.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date/time format. Use DD/MM/YYYY for date and HH:MM for time.' });
      }

      // Check if trigger time is in the past (allowing 60s grace period for immediate testing)
      if (triggerAtUTC < new Date(Date.now() - 60000)) {
        return res.status(400).json({ success: false, error: 'Reminder time is in the past. Please set a future date/time.' });
      }

      const companyName = company || (await Lead.findById(leadId))?.company || 'Unknown';

      const reminder = await Reminder.create({
        leadId,
        company: companyName,
        reminderMessage,
        reminderDateIST,
        reminderTimeIST,
        triggerAtUTC,
        recipientEmail,
        createdBy: createdBy || 'Sales Team',
        status: 'pending'
      });

      // If reminder is due immediately (e.g. set for current time), send email right away!
      if (triggerAtUTC <= new Date()) {
        try {
          const lead = await Lead.findById(leadId).lean();
          const subject = `🔔 Reminder: ${reminderMessage} — ${companyName}`;
          const textMessage = `Reminder for: ${companyName}\nMessage: ${reminderMessage}\nScheduled: ${reminderDateIST} at ${reminderTimeIST} IST`;
          const htmlContent = buildReminderEmailHTML(reminder, lead);

          await sendReminderEmail(recipientEmail, subject, textMessage, htmlContent);
          await Reminder.findByIdAndUpdate(reminder._id, { status: 'sent', sentAt: new Date() });
          reminder.status = 'sent';
        } catch (e) {
          console.error('Immediate reminder email dispatch error:', e);
        }
      }

      return res.status(201).json({ success: true, reminder });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
