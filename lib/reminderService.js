import nodemailer from 'nodemailer';
import Lead from '../models/Lead';
import Setting from '../models/Setting';
import Notification from '../models/Notification';
import dbConnect from './dbConnect';

export async function sendNotificationEmail(toEmail, subject, textContent, htmlContent) {
  const enableNotifications = process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false';
  if (!enableNotifications) {
    console.log('[Email Suppressed]: Notifications disabled in environment.');
    return { success: false, reason: 'Notifications disabled' };
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log(`[Email Alert Logged to DB]: Recipient: ${toEmail}. Set SMTP_USER and SMTP_PASS in .env.local for live SMTP delivery.`);
    return { success: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Lead CRM Alert" <${user}>`,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log('[SMTP Live Delivery Success]: Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[SMTP Live Delivery Error]:', err.message);
    return { success: false, error: err.message };
  }
}

// Dual Reminder Engine: Sends 2-Day & 1-Day Prior Alerts WITH Lead Notes & Zero Inbox Spam
export async function checkAndSendReminders() {
  await dbConnect();
  try {
    let setting = await Setting.findOne();
    const envEmailsStr = process.env.REGISTERED_EMAILS || 'admin@yourcompany.com,intern@yourcompany.com';
    const envEmailsList = envEmailsStr.split(',').map(e => e.trim()).filter(Boolean);

    if (!setting) {
      setting = await Setting.create({ registeredEmails: envEmailsList });
    }

    const registeredEmailsList = (setting.registeredEmails && setting.registeredEmails.length > 0)
      ? setting.registeredEmails
      : envEmailsList;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Date 1: Exactly 2 Days Before
    const target2Days = new Date(today);
    target2Days.setDate(target2Days.getDate() + 2);
    const target2DaysStr = target2Days.toISOString().split('T')[0];

    // Date 2: Exactly 1 Day Before
    const target1Day = new Date(today);
    target1Day.setDate(target1Day.getDate() + 1);
    const target1DayStr = target1Day.toISOString().split('T')[0];

    const todayStr = today.toISOString().split('T')[0];

    const leads = await Lead.find({});
    let newAlerts = [];

    for (const lead of leads) {
      const datesToCheck = [
        { type: 'Follow up', dateStr: lead.follow_up_dates },
        { type: 'Reachout', dateStr: lead.reachout_date },
        { type: 'Scheduled Meeting', dateStr: (lead.status === 'Meeting Scheduled' || (lead.next_action || '').toLowerCase().includes('meeting')) ? (lead.follow_up_dates || lead.reachout_date) : null }
      ];

      for (const item of datesToCheck) {
        if (!item.dateStr) continue;

        const itemDate = item.dateStr.split('T')[0];
        const is2DaysBefore = (itemDate === target2DaysStr);
        const is1DayBefore = (itemDate === target1DayStr);
        const isToday = (itemDate === todayStr);

        if (is2DaysBefore || is1DayBefore || isToday) {
          const timingLabel = is2DaysBefore ? '2 DAYS ADVANCE' : is1DayBefore ? '1 DAY PRIOR' : 'DUE TODAY';

          // Send to ALL registered email recipients (Admin + Intern)
          for (const recipientEmail of registeredEmailsList) {
            // STRICT DUPLICATE PREVENTION: Key unique per lead, event type, milestone timing, date, and recipient
            const notifKey = `${lead._id}_${item.type}_${timingLabel}_${itemDate}_${recipientEmail}`;

            // Check MongoDB to ensure we NEVER send duplicate email spam
            const exists = await Notification.findOne({ key: notifKey });

            if (!exists) {
              const title = is2DaysBefore
                ? `📅 2-Day Advance Alert: ${item.type} with ${lead.company}`
                : is1DayBefore
                ? `🚨 1-Day Urgent Reminder: ${item.type} with ${lead.company}`
                : `⚡ TODAY: ${item.type} with ${lead.company}`;

              const textMessage = `
Scheduled ${item.type} with ${lead.company}
Date: ${itemDate} (${timingLabel})
Founder / Contact: ${lead.founder || 'N/A'} (${lead.contact || 'N/A'}, ${lead.email || 'N/A'})
Location: ${lead.city || 'N/A'} ${lead.locations ? '• ' + lead.locations : ''}
Pain Point: ${lead.pain_point || 'None specified'}
Next Action Step: ${lead.next_action || 'N/A'}

--- LEAD CONVERSATION NOTES ---
${lead.notes || 'No specific notes recorded for this lead.'}
              `.trim();

              const htmlContent = `
                <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 24px; background-color: #f8fafc; color: #0f172a;">
                  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
                    
                    <!-- Header Banner -->
                    <div style="background: ${is2DaysBefore ? 'linear-gradient(135deg, #0284c7, #0369a1)' : is1DayBefore ? 'linear-gradient(135deg, #4f46e5, #4338ca)' : 'linear-gradient(135deg, #d97706, #b45309)'}; padding: 24px; color: #ffffff;">
                      <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px;">${timingLabel} NOTIFICATION</span>
                      <h2 style="margin: 12px 0 4px 0; font-size: 22px; font-weight: 800;">${lead.company}</h2>
                      <p style="margin: 0; opacity: 0.9; font-size: 14px;">Scheduled ${item.type} on <strong>${itemDate}</strong></p>
                    </div>

                    <!-- Lead Details Body -->
                    <div style="padding: 28px;">
                      
                      <!-- Lead Prospect Overview -->
                      <h4 style="color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0;">Prospect Details</h4>
                      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
                        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Founder / Contact:</strong></td><td style="padding: 8px 0; font-weight: 600;">${lead.founder || 'N/A'}</td></tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">${lead.email || 'N/A'}</a></td></tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Phone / Contact:</strong></td><td style="padding: 8px 0; font-weight: 600;">${lead.contact || 'N/A'}</td></tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>City / Location:</strong></td><td style="padding: 8px 0;">${lead.city || 'N/A'} ${lead.locations ? '• ' + lead.locations : ''}</td></tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Pain Point:</strong></td><td style="padding: 8px 0; color: #b91c1c;">${lead.pain_point || 'None specified'}</td></tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Current Status:</strong></td><td style="padding: 8px 0;"><span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 12px;">${lead.status || 'New'}</span></td></tr>
                        <tr><td style="padding: 8px 0; color: #64748b;"><strong>Immediate Next Action:</strong></td><td style="padding: 8px 0; color: #047857; font-weight: 700;">${lead.next_action || 'Follow up with prospect'}</td></tr>
                      </table>

                      <!-- PROMINENT LEAD CONVERSATION NOTES BOX -->
                      <div style="background: #f8fafc; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 18px; margin-top: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                          <strong style="color: #1e1b4b; font-size: 14px;">📝 Lead Conversation & Follow-up Notes:</strong>
                        </div>
                        <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${lead.notes ? lead.notes : 'No specific conversation notes recorded yet. Log into Lead CRM to add updates.'}</p>
                      </div>

                    </div>

                    <!-- Footer -->
                    <div style="background: #f1f5f9; padding: 14px 28px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0;">
                      Autonomous Background Engine • Sent exactly once to ${recipientEmail} • No Spam Guaranteed
                    </div>

                  </div>
                </div>
              `;

              await sendNotificationEmail(recipientEmail, title, textMessage, htmlContent);

              const notifEntry = await Notification.create({
                key: notifKey,
                leadId: String(lead._id),
                company: lead.company,
                type: item.type,
                eventDate: itemDate,
                timing: timingLabel,
                title,
                message: textMessage,
                recipient: recipientEmail
              });

              newAlerts.push(notifEntry);
            }
          }
        }
      }
    }

    return newAlerts;
  } catch (err) {
    console.error('Error in dual team reminder scanner:', err);
    return [];
  }
}
