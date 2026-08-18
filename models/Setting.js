const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  registeredEmails: { type: [String], default: ['admin@yourcompany.com', 'intern@yourcompany.com'] },
  reminderDaysBefore: { type: Number, default: 1 },
  nurtureDaysThreshold: { type: Number, default: 30 }
}, { timestamps: true });

module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
