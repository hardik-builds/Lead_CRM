const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  registeredEmails: { type: [String], default: ['admin@yourcompany.com', 'intern@yourcompany.com'] },
  enableEmailNotifications: { type: Boolean, default: true },
  reminderDaysBefore: { type: Number, default: 1 },
  nurtureDaysThreshold: { type: Number, default: 30 },
  smtp: {
    host: { type: String, default: 'smtp.gmail.com' },
    port: { type: Number, default: 587 },
    user: { type: String, default: '' },
    pass: { type: String, default: '' },
    from: { type: String, default: 'Lead CRM Notifications <no-reply@leadcrm.com>' }
  }
}, { timestamps: true });

module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
