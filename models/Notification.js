const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  leadId: { type: String },
  company: { type: String },
  type: { type: String },
  eventDate: { type: String },
  timing: { type: String },
  title: { type: String },
  message: { type: String },
  recipient: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
