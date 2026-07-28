import nodemailer from 'nodemailer';
import Lead from '../models/Lead';
import Setting from '../models/Setting';
import Notification from '../models/Notification';
import dbConnect from './dbConnect';

// In-Memory Key Cache to prevent double-sending within the same server session
const sentKeysSet = new Set();

// Robust Date Normalizer: Converts DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD to ISO YYYY-MM-DD
export function normalizeToISO(str) {
  if (!str) return null;
  str = String(str).trim();

  // 1. Match DD/MM/YYYY or DD-MM-YYYY (e.g. 29/07/2026, 28-07-2026)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 2. Match YYYY-MM-DD (e.g. 2026-07-29)
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 3. Fallback: JS Date Parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

export async function sendNotificationEmail(toEmail, subject, textContent, htmlContent) {
  const enableNotifications = process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false';
  if (!enableNotifications) {
    console.log('[Email Suppressed]: Notifications disabled in environment.');
    return { success: false, reason: 'Notifications disabled' };
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS;

  if (!host || !user || !rawPass) {
    console.log(`[Email Alert Logged to DB]: Recipient: ${toEmail}. Set SMTP_USER and SMTP_PASS in .env.local for live delivery.`);
    return { success: true, simulated: true };
  }

  const cleanPass = rawPass.replace(/\s+/g, '');

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass: cleanPass }
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

// 1-Day Prior & Due Today Reminder Engine
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

    // Date 1: Exactly 1 Day Before (Normalized YYYY-MM-DD)
    const target1Day = new Date(today);
    target1Day.setDate(target1Day.getDate() + 1);
    const target1DayStr = target1Day.toISOString().split('T')[0];

    const todayStr = today.toISOString().split('T')[0];

    const leads = await Lead.find({});
    let newAlerts = [];

    for (const lead of leads) {
      const datesToCheck = [
        { type: 'Follow up', rawDate: lead.follow_up_dates },
        { type: 'Reachout', rawDate: lead.reachout_date },
        { type: 'Scheduled Meeting', rawDate: (lead.status === 'Meeting Scheduled' || (lead.new_status || '').toLowerCase().includes('meeting') || (lead.next_action || '').toLowerCase().includes('meeting')) ? (lead.follow_up_dates || lead.reachout_date) : null }
      ];

      for (const item of datesToCheck) {
        if (!item.rawDate) continue;

        const normalizedDate = normalizeToISO(item.rawDate);
        if (!normalizedDate) continue;

        const is1DayBefore = (normalizedDate === target1DayStr);
        const isToday = (normalizedDate === todayStr);

        if (is1DayBefore || isToday) {
          const timingLabel = is1DayBefore ? '1 DAY PRIOR' : 'DUE TODAY';

          for (const recipientEmail of registeredEmailsList) {
            const notifKey = `${String(lead._id)}_${item.type}_${timingLabel}_${normalizedDate}_${recipientEmail}`;

            if (sentKeysSet.has(notifKey)) {
              continue;
            }

            const existsInDb = await Notification.findOne({ key: notifKey });
            if (existsInDb) {
              sentKeysSet.add(notifKey);
              continue;
            }

            sentKeysSet.add(notifKey);

            const title = is1DayBefore
              ? `🚨 1-Day Urgent Reminder: ${item.type} with ${lead.company}`
              : `⚡ TODAY: ${item.type} with ${lead.company}`;

            const textMessage = `
Scheduled ${item.type} with ${lead.company}
Date: ${normalizedDate} (${timingLabel})
Founder / Contact: ${lead.founder || 'N/A'} (${lead.contact || 'N/A'}, ${lead.email || 'N/A'})
Location: ${lead.city || 'N/A'} ${lead.locations ? '• ' + lead.locations : ''}
Pain Point: ${lead.pain_point || 'None specified'}
Next Action Step: ${lead.next_action || 'N/A'}

--- LEAD CONVERSATION NOTES ---
${lead.notes || 'No specific notes recorded for this lead.'}
            `.trim();

            const htmlContent = `
              <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #f8fafc; color: #0f172a;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
                  
                  <div style="background: ${is1DayBefore ? '#4f46e5' : '#d97706'}; padding: 24px; color: #ffffff;">
                    <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 20px;">${timingLabel} NOTIFICATION</span>
                    <h2 style="margin: 12px 0 4px 0; font-size: 22px; font-weight: 800;">${lead.company}</h2>
                    <p style="margin: 0; opacity: 0.9; font-size: 14px;">Scheduled ${item.type} on <strong>${normalizedDate}</strong></p>
                  </div>

                  <div style="padding: 24px;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Founder / Contact:</strong></td><td style="padding: 8px 0; font-weight: 600;">${lead.founder || 'N/A'}</td></tr>
                      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">${lead.email || 'N/A'}</a></td></tr>
                      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 8px 0; font-weight: 600;">${lead.contact || 'N/A'}</td></tr>
                      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>City:</strong></td><td style="padding: 8px 0;">${lead.city || 'N/A'}</td></tr>
                      <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Pain Point:</strong></td><td style="padding: 8px 0; color: #b91c1c;">${lead.pain_point || 'None specified'}</td></tr>
                      <tr><td style="padding: 8px 0; color: #64748b;"><strong>Next Action:</strong></td><td style="padding: 8px 0; color: #047857; font-weight: 700;">${lead.next_action || 'Follow up'}</td></tr>
                    </table>

                    <div style="background: #f8fafc; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 16px;">
                      <strong style="color: #1e1b4b; font-size: 13px;">📝 Lead Conversation Notes:</strong>
                      <p style="margin: 6px 0 0 0; color: #334155; font-size: 13px; line-height: 1.5;">${lead.notes || 'No specific notes recorded.'}</p>
                    </div>
                  </div>

                  <div style="background: #f1f5f9; padding: 12px 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0;">
                    Single Delivery Guaranteed • Sent to ${recipientEmail}
                  </div>

                </div>
              </div>
            `;

            const notifEntry = await Notification.create({
              key: notifKey,
              leadId: String(lead._id),
              company: lead.company,
              type: item.type,
              eventDate: normalizedDate,
              timing: timingLabel,
              title,
              message: textMessage,
              recipient: recipientEmail
            });

            await sendNotificationEmail(recipientEmail, title, textMessage, htmlContent);

            newAlerts.push(notifEntry);
          }
        }
      }
    }

    return newAlerts;
  } catch (err) {
    console.error('Error in reminder scanner:', err);
    return [];
  }
}
