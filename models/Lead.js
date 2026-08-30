import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  performedBy: { type: String, default: 'Sales Team' }
});

const LeadSchema = new mongoose.Schema({
  company: { type: String, required: true, trim: true },
  city: { type: String, default: '' },
  locations: { type: String, default: '' },
  founder: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  contact: { type: String, default: '' },
  email: { type: String, default: '' },
  pain_point: { type: String, default: '' },
  source: { type: String, default: 'Direct' },
  date_added: { type: String, default: () => new Date().toISOString().split('T')[0] },
  assigned_to: { type: String, default: 'Sales Team' },
  status: { type: String, default: 'Contacted' },
  notes: { type: String, default: '' },
  score_of_client: { type: mongoose.Schema.Types.Mixed, default: '5' },
  reachout_date: { type: String, default: '' },
  new_status: { type: String, default: '' },
  next_action: { type: String, default: '' },
  follow_up_dates: { type: String, default: '' },
  activity_log: [ActivityLogSchema]
}, { timestamps: true });

// Pre-save hook: Route "Not Interested" leads to Monthly Nurture List automatically & log activity
LeadSchema.pre('save', function(next) {
  const currentStatus = (this.status || '').toLowerCase();
  const currentNewStatus = (this.new_status || '').toLowerCase();

  if (currentStatus.includes('not interested') || currentNewStatus.includes('not interested')) {
    this.new_status = 'Nurture (Not Interested)';
  }

  // Push initial creation activity if log is empty
  if (!this.activity_log || this.activity_log.length === 0) {
    this.activity_log = [{
      timestamp: new Date(),
      action: 'Lead Created',
      details: `Registered with status '${this.status || 'New'}'`,
      performedBy: this.assigned_to || 'Sales Team'
    }];
  }

  next();
});

export default mongoose.models.Lead || mongoose.model('Lead', LeadSchema, 'leads');
