const mongoose = require('mongoose');

async function debugReminders() {
  try {
    const mongoUri = 'mongodb+srv://Hardik:Hardik%40152005@cluster0.jzsf9gw.mongodb.net/Lead_CRM';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const reminderSchema = new mongoose.Schema({
      leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
      company: { type: String, required: true },
      reminderMessage: { type: String, required: true },
      reminderDateIST: { type: String, required: true },
      reminderTimeIST: { type: String, required: true },
      triggerAtUTC: { type: Date, required: true },
      recipientEmail: { type: String, required: true },
      status: { type: String, default: 'pending' },
      sentAt: { type: Date, default: null }
    }, { timestamps: true });

    const Reminder = mongoose.models.Reminder || mongoose.model('Reminder', reminderSchema);

    const allReminders = await Reminder.find({}).sort({ createdAt: -1 });
    console.log(`\nFound ${allReminders.length} total reminders in database:`);
    for (const r of allReminders) {
      console.log(`- ID: ${r._id}`);
      console.log(`  Company: ${r.company}`);
      console.log(`  Message: ${r.reminderMessage}`);
      console.log(`  Date/Time IST: ${r.reminderDateIST} ${r.reminderTimeIST}`);
      console.log(`  Trigger UTC: ${r.triggerAtUTC ? r.triggerAtUTC.toISOString() : 'NULL'}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Recipient: ${r.recipientEmail}`);
      console.log(`  Current UTC: ${new Date().toISOString()}`);
      console.log(`  Is Due? (triggerAtUTC <= now): ${r.triggerAtUTC <= new Date()}`);
      console.log('----------------------------------------------------');
    }

    process.exit(0);
  } catch (err) {
    console.error('Debug error:', err);
    process.exit(1);
  }
}

debugReminders();
