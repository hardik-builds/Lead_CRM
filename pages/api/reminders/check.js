import dbConnect from '../../../lib/dbConnect';
import Reminder from '../../../models/Reminder';
import Lead from '../../../models/Lead';
import { sendReminderEmail, buildReminderEmailHTML } from '../../../lib/reminderService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  await dbConnect();

  try {
    const now = new Date();

    // Find all pending reminders where trigger time has passed (or is now)
    const dueReminders = await Reminder.find({
      status: 'pending',
      triggerAtUTC: { $lte: now }
    });

    if (dueReminders.length === 0) {
      return res.status(200).json({ success: true, triggered: 0, message: 'No pending reminders due.' });
    }

    let triggered = 0;

    for (const reminder of dueReminders) {
      // Fetch linked lead for context
      let lead = null;
      try {
        lead = await Lead.findById(reminder.leadId).lean();
      } catch (e) {
        // Lead may have been deleted, proceed without it
      }

      const subject = `🔔 Reminder: ${reminder.reminderMessage} — ${reminder.company}`;
      const textMessage = `
Reminder for: ${reminder.company}
Message: ${reminder.reminderMessage}
Scheduled: ${reminder.reminderDateIST} at ${reminder.reminderTimeIST} IST
${lead ? `Founder: ${lead.founder || 'N/A'} | Phone: ${lead.contact || 'N/A'} | Email: ${lead.email || 'N/A'}` : ''}
      `.trim();

      const htmlContent = buildReminderEmailHTML(reminder, lead);

      const emailResult = await sendReminderEmail(
        reminder.recipientEmail,
        subject,
        textMessage,
        htmlContent
      );

      // Mark as sent regardless of email delivery (to prevent re-sending)
      await Reminder.findByIdAndUpdate(reminder._id, {
        status: 'sent',
        sentAt: new Date()
      });

      triggered++;
      console.log(`[Reminder Triggered] ID: ${reminder._id} | Company: ${reminder.company} | Email: ${emailResult.success ? 'Sent' : 'Failed'}`);
    }

    return res.status(200).json({ success: true, triggered, message: `${triggered} reminder(s) triggered and sent.` });
  } catch (err) {
    console.error('[Reminder Check Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
