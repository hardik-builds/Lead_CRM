const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  company: { type: String, required: true },
  reminderMessage: { type: String, required: true },
  reminderDateIST: { type: String, required: true }, // DD/MM/YYYY
  reminderTimeIST: { type: String, required: true }, // HH:MM (24hr IST)
  triggerAtUTC: { type: Date, required: true, index: true },
  recipientEmail: { type: String, required: true },
  status: { type: String, enum: ['pending', 'sent', 'cancelled'], default: 'pending', index: true },
  sentAt: { type: Date, default: null },
  createdBy: { type: String, default: 'Sales Team' }
}, { timestamps: true });

module.exports = mongoose.models.Reminder || mongoose.model('Reminder', reminderSchema);
