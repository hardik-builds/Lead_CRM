import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import { checkAndSendReminders, normalizeToISO } from '../../../lib/reminderService';
import { verifyRequestAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  // Verify JWT Authentication for API safety
  const auth = verifyRequestAuth(req);
  if (!auth.valid) {
    return res.status(401).json({ success: false, error: auth.error });
  }

  await dbConnect();

  if (req.method === 'GET') {
    try {
      const tab = req.query.tab || 'all';
      const search = (req.query.search || '').trim().toLowerCase();
      const statusFilter = req.query.status || '';
      const filterDate = req.query.filterDate || '';

      const cacheKey = `leads_${tab}_${search}_${statusFilter}_${filterDate}`;
      const cached = cacheService.get(cacheKey);

      if (cached) {
        return res.status(200).json({ ...cached, cached: true });
      }

      let query = {};
      const todayStr = new Date().toISOString().split('T')[0];

      // Universal Search Engine: Matches company, founder, contact, email, city, notes, AND dates
      if (search) {
        query.$or = [
          { company: { $regex: search, $options: 'i' } },
          { founder: { $regex: search, $options: 'i' } },
          { contact: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } },
          { locations: { $regex: search, $options: 'i' } },
          { pain_point: { $regex: search, $options: 'i' } },
          { next_action: { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } },
          { assigned_to: { $regex: search, $options: 'i' } },
          { source: { $regex: search, $options: 'i' } },
          { follow_up_dates: { $regex: search, $options: 'i' } },
          { reachout_date: { $regex: search, $options: 'i' } },
          { date_added: { $regex: search, $options: 'i' } }
        ];
      }

      if (statusFilter) {
        query.status = new RegExp(`^${statusFilter}$`, 'i');
      }

      let allLeads = await Lead.find(query).sort({ createdAt: -1 }).lean();

      // Filter by Exact Date if specified
      if (filterDate) {
        const isoTarget = normalizeToISO(filterDate) || filterDate;
        allLeads = allLeads.filter(l => {
          const fuISO = normalizeToISO(l.follow_up_dates);
          const roISO = normalizeToISO(l.reachout_date);
          const daISO = normalizeToISO(l.date_added);
          return (fuISO === isoTarget || roISO === isoTarget || daISO === isoTarget || l.follow_up_dates === filterDate || l.reachout_date === filterDate);
        });
      }

      // Tab Extractions & Filters
      let filtered = allLeads;
      if (tab === 'followups') {
        filtered = allLeads.filter(l => l.follow_up_dates || l.reachout_date);
      } else if (tab === 'today') {
        filtered = allLeads.filter(l => {
          const fuISO = normalizeToISO(l.follow_up_dates);
          const roISO = normalizeToISO(l.reachout_date);
          return fuISO === todayStr || roISO === todayStr;
        });
      } else if (tab === 'overdue') {
        filtered = allLeads.filter(l => {
          const fuISO = normalizeToISO(l.follow_up_dates);
          const roISO = normalizeToISO(l.reachout_date);
          return (fuISO && fuISO < todayStr) || (roISO && roISO < todayStr);
        });
      } else if (tab === 'reachout') {
        filtered = allLeads.filter(l => l.reachout_date);
      } else if (tab === 'nurture') {
        const threshold = parseInt(process.env.NURTURE_DAYS_THRESHOLD || '30', 10);
        filtered = allLeads.filter(l => {
          const st = (l.status || '').toLowerCase();
          const nst = (l.new_status || '').toLowerCase();
          const notes = (l.notes || '').toLowerCase();

          if (st.includes('nurture') || nst.includes('nurture') || st.includes('not interested') || nst.includes('not interested') || notes.includes('not interested')) {
            return true;
          }
          if (l.follow_up_dates) {
            const diffDays = Math.ceil((new Date(l.follow_up_dates) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
            return diffDays >= 7 && diffDays <= threshold;
          }
          return false;
        });
      } else if (tab === 'meetings') {
        filtered = allLeads.filter(l => {
          const st = (l.status || '').toLowerCase();
          const nst = (l.new_status || '').toLowerCase();
          const action = (l.next_action || '').toLowerCase();
          const notes = (l.notes || '').toLowerCase();
          return st.includes('meeting') || nst.includes('meeting') || action.includes('meeting') || notes.includes('meeting');
        });
      }

      const totalCount = await Lead.countDocuments();
      const followupsCount = await Lead.countDocuments({
        $or: [{ follow_up_dates: { $ne: '' } }, { reachout_date: { $ne: '' } }]
      });
      const nurtureCount = await Lead.countDocuments({
        $or: [
          { status: /nurture/i },
          { new_status: /nurture/i },
          { status: /not interested/i },
          { new_status: /not interested/i }
        ]
      });
      const meetingsCount = await Lead.countDocuments({
        $or: [
          { status: /meeting/i },
          { new_status: /meeting/i },
          { next_action: /meeting/i },
          { notes: /meeting/i }
        ]
      });

      const responsePayload = {
        success: true,
        total: totalCount,
        filteredTotal: filtered.length,
        leads: filtered,
        kpis: {
          totalLeads: totalCount,
          followupsCount,
          nurtureCount,
          meetingsCount
        }
      };

      cacheService.set(cacheKey, responsePayload);
      return res.status(200).json(responsePayload);
    } catch (err) {
      console.error('API /leads GET error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  } else if (req.method === 'POST') {
    try {
      const lead = new Lead(req.body);
      await lead.save();

      cacheService.flush();
      checkAndSendReminders();

      return res.status(201).json({ success: true, lead });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
