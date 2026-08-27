import nodemailer from 'nodemailer';
import Lead from '../models/Lead';
import Setting from '../models/Setting';
import Notification from '../models/Notification';
import dbConnect from './dbConnect';

// In-Memory Key Cache to prevent double-sending within the same server session
const sentKeysSet = new Set();

// Send Reminder Email via SMTP (Used ONLY for custom reminders)
export async function sendReminderEmail(toEmail, subject, textContent, htmlContent) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS;

  if (!host || !user || !rawPass) {
    console.log(`[Reminder Email Skipped]: No SMTP credentials configured. Recipient: ${toEmail}`);
    return { success: false, reason: 'SMTP not configured' };
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
      from: process.env.SMTP_FROM || `"LeadPulse CRM Reminder" <${user}>`,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log('[Reminder Email Sent]: Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Reminder Email Error]:', err.message);
    return { success: false, error: err.message };
  }
}

// Build Reminder Email HTML Template
export function buildReminderEmailHTML(reminder, lead) {
  const dateStr = reminder.reminderDateIST || 'N/A';
  const timeStr = reminder.reminderTimeIST || 'N/A';

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; background-color: #f0f4f8; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 8px 24px rgba(0,0,0,0.08);">
        
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 28px; color: #ffffff;">
          <span style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">🔔 REMINDER ALERT</span>
          <h2 style="margin: 14px 0 6px 0; font-size: 22px; font-weight: 800;">${reminder.company}</h2>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">Scheduled for <strong>${dateStr}</strong> at <strong>${timeStr} IST</strong></p>
        </div>

        <div style="padding: 24px;">
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <strong style="color: #92400e; font-size: 13px;">📌 Your Reminder:</strong>
            <p style="margin: 8px 0 0 0; color: #78350f; font-size: 15px; font-weight: 600; line-height: 1.5;">${reminder.reminderMessage}</p>
          </div>

          ${lead ? `
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; width: 120px;"><strong>Founder:</strong></td><td style="padding: 8px 0; font-weight: 600;">${lead.founder || 'N/A'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Phone:</strong></td><td style="padding: 8px 0; font-weight: 600;">${lead.contact || 'N/A'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 8px 0;">${lead.email || 'N/A'}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b;"><strong>City:</strong></td><td style="padding: 8px 0;">${lead.city || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b;"><strong>Next Action:</strong></td><td style="padding: 8px 0; color: #047857; font-weight: 700;">${lead.next_action || 'Follow up'}</td></tr>
          </table>
          ` : ''}
        </div>

        <div style="background: #f1f5f9; padding: 12px 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0;">
          LeadPulse CRM • Reminder delivered to ${reminder.recipientEmail}
        </div>
      </div>
    </div>
  `;
}

// Convert IST date (DD/MM/YYYY or YYYY-MM-DD) + time (HH:MM) to UTC Date object
export function istToUTC(dateIST, timeIST) {
  if (!dateIST || !timeIST) return null;

  let day, month, year;
  const strDate = String(dateIST).trim();
  if (strDate.includes('/')) {
    const parts = strDate.split('/');
    if (parts.length !== 3) return null;
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // 0-indexed
    year = parseInt(parts[2], 10);
  } else if (strDate.includes('-')) {
    const parts = strDate.split('-');
    if (parts.length !== 3) return null;
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    return null;
  }

  const [hours, minutes] = String(timeIST).trim().split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  // IST is UTC+5:30 -> UTC timestamp = Date.UTC(year, month, day, hours, minutes) - (5.5 * 3600 * 1000)
  const utcMs = Date.UTC(year, month, day, hours, minutes) - (5.5 * 60 * 60 * 1000);
  return new Date(utcMs);
}

// Old bulk notification stub (disabled)
export async function sendNotificationEmail() {
  return { success: false, reason: 'Bulk email notification system removed' };
}

// Robust Indian Date Normalizer: Converts ANY date format or embedded sentence date to DD/MM/YYYY
export function normalizeToIndianDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }
  let str = String(val).trim();
  if (!str) return '';

  // 1. Match embedded DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY inside text (e.g. "follow up on 15/08/2026")
  const dmyMatch = str.match(/(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})/);
  if (dmyMatch) {
    let p1 = parseInt(dmyMatch[1], 10);
    let p2 = parseInt(dmyMatch[2], 10);
    let year = dmyMatch[3];
    let day = p1;
    let month = p2;

    if (p1 <= 12 && p2 > 12) {
      day = p2;
      month = p1;
    }

    const dStr = String(day).padStart(2, '0');
    const mStr = String(month).padStart(2, '0');
    return `${dStr}/${mStr}/${year}`;
  }

  // 2. Match embedded YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (e.g. "follow up on 2026-08-15")
  const ymdMatch = str.match(/(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 3. Fallback: JS Date Parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return str;
}

// Convert DD/MM/YYYY or YYYY-MM-DD to ISO YYYY-MM-DD for accurate cron & date logic
export function normalizeToISO(val) {
  if (!val) return null;
  const str = String(val).trim();
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }
  const ymdMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
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

    const now = new Date();
    const currentHour = now.getHours();

    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = todayDate.toISOString().split('T')[0];

    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

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

        // 1-Day Prior: Target date is tomorrow (Send ONLY at Night 10:00 PM / 22:00 onwards)
        const is1DayBefore = (normalizedDate === tomorrowStr) && (currentHour >= 22);

        // Same-Day: Target date is today (Send ONLY in Morning 8:00 AM to 11:59 AM window)
        const isToday = (normalizedDate === todayStr) && (currentHour >= 8 && currentHour < 12);

        if (is1DayBefore || isToday) {
          const timingLabel = is1DayBefore ? '1-DAY PRIOR (10:00 PM)' : 'SAME-DAY (8:00 AM)';

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
              ? `🚨 1-Day Prior Alert (10:00 PM): ${item.type} tomorrow with ${lead.company}`
              : `⚡ TODAY MORNING ALERT (8:00 AM): ${item.type} with ${lead.company}`;

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
