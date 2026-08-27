const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

async function testFullReminderFlow() {
  try {
    const mongoUri = 'mongodb+srv://Hardik:Hardik%40152005@cluster0.jzsf9gw.mongodb.net/Lead_CRM';
    await mongoose.connect(mongoUri);
    console.log('1. Connected to MongoDB');

    // Test SMTP transporter directly
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'hsingh.doc04@gmail.com',
        pass: 'sgvkooossspvueyp'
      }
    });

    console.log('2. Sending test email via SMTP...');
    const mailInfo = await transporter.sendMail({
      from: 'Lead CRM Notifications <hsingh.doc04@gmail.com>',
      to: 'hsingh.doc04@gmail.com',
      subject: '🔔 LeadPulse CRM Test Reminder Email',
      text: 'This is a test reminder email to verify SMTP delivery.',
      html: '<h2>🔔 LeadPulse CRM Test Email</h2><p>Your SMTP email configuration is working 100%!</p>'
    });

    console.log('3. Email Sent Successfully! Message ID:', mailInfo.messageId);
    process.exit(0);
  } catch (err) {
    console.error('Email Test Error:', err);
    process.exit(1);
  }
}

testFullReminderFlow();
