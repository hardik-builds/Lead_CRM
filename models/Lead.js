const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  company: { type: String, required: true, trim: true, index: true },
  city: { type: String, trim: true },
  locations: { type: String, trim: true },
  founder: { type: String, trim: true },
  linkedin: { type: String, trim: true },
  contact: { type: String, trim: true },
  email: { type: String, trim: true, index: true },
  pain_point: { type: String, trim: true },
  source: { type: String, default: 'Direct' },
  date_added: { type: String, default: () => new Date().toISOString().split('T')[0] },
  assigned_to: { type: String, default: 'Sales Team' },
  status: { type: String, default: 'New', index: true },
  notes: { type: String, trim: true },
  score_of_client: { type: Number, default: 5, index: true }, // Out of 10
  reachout_date: { type: String, index: true },
  new_status: { type: String, trim: true },
  next_action: { type: String, trim: true },
  follow_up_dates: { type: String, index: true },
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Auto calculate score out of 10 if missing
leadSchema.pre('save', function(next) {
  if (this.score_of_client === undefined || this.score_of_client === null) {
    let computed = 5; // base score out of 10
    const st = (this.status || '').toLowerCase();

    if (st.includes('meeting')) computed += 3;
    else if (st.includes('contacted') || st.includes('qualified')) computed += 1;
    else if (st.includes('won')) computed += 4;
    else if (st.includes('lost')) computed = 1;

    if (this.email) computed += 1;
    if (this.contact) computed += 1;

    this.score_of_client = Math.min(Math.max(computed, 1), 10);
  } else if (this.score_of_client > 10) {
    // If entered out of 100, normalize to scale of 10
    this.score_of_client = Math.min(Math.max(Math.round(this.score_of_client / 10), 1), 10);
  }
  next();
});

module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
