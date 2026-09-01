import mongoose from 'mongoose';
import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import { checkAndSendReminders, normalizeToISO, normalizeToIndianDate } from '../../../lib/reminderService';
import { verifyRequestAuth } from '../../../lib/auth';

// Universal Multi-Format Date Matcher for Legacy & New Formats
function matchesDateFilter(rawFieldVal, queryStr) {
  if (!rawFieldVal || !queryStr) return false;
  const val = String(rawFieldVal).trim();
  const q = String(queryStr).trim();
  if (!val || !q) return false;

  // 1. Direct raw substring match (case insensitive)
  if (val.toLowerCase().includes(q.toLowerCase())) return true;

  // 2. Indian DD/MM/YYYY format normalized match
  const indianVal = normalizeToIndianDate(val);
  const indianQ = normalizeToIndianDate(q);
  if (indianVal && indianQ && indianVal === indianQ) return true;
  if (indianVal && indianVal.includes(q)) return true;

  // 3. ISO format normalized match (YYYY-MM-DD)
  const isoVal = normalizeToISO(val);
  const isoQ = normalizeToISO(q);
  if (isoVal && isoQ && isoVal === isoQ) return true;

  // 4. Strip separators match (slashes, dashes, dots)
  const cleanVal = (indianVal || val).replace(/[-/. ]/g, '');
  const cleanQ = q.replace(/[-/. ]/g, '');
  if (cleanVal && cleanQ && cleanVal.includes(cleanQ)) return true;

  return false;
}

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

      // Always fetch 100% fresh real-time leads directly from MongoDB Atlas
      cacheService.flush();

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

      // Filter by Exact or Partial Date if specified (supports legacy & new date formats)
      if (filterDate) {
        allLeads = allLeads.filter(l => {
          return (
            matchesDateFilter(l.follow_up_dates, filterDate) ||
            matchesDateFilter(l.reachout_date, filterDate) ||
            matchesDateFilter(l.date_added, filterDate)
          );
        });
      }

      // Tab Extractions & Strict Overdue / Today Filters
      // Helper to classify lead into 100% mutually exclusive disjoint category
      const getCategory = (l) => {
        const st = (l.status || '').toLowerCase().trim();
        const nst = (l.new_status || '').toLowerCase().trim();
        const act = (l.next_action || '').toLowerCase().trim();
        const fu = (l.follow_up_dates || '').toLowerCase().trim();
        const notes = (l.notes || '').toLowerCase().trim();

        // 1. Explicit Status / New Status Assigned by User (HIGHEST PRIORITY OVER NOTES!)
        if (st === 'won' || nst === 'won' || st.includes('won') || nst.includes('won')) return 'won';
        if (st === 'lost' || nst === 'lost' || st.includes('lost') || nst.includes('lost')) return 'lost';
        if (st.includes('not interested') || nst.includes('not interested') || st.includes('hung up') || nst.includes('hung up') || st.includes('rude') || nst.includes('rude')) {
          return 'not_interested';
        }
        if (st === 'qualified' || nst.includes('qualified')) {
          return 'qualified';
        }
        if (st.includes('meeting') || nst.includes('meeting') || st.includes('demo') || nst.includes('demo')) {
          return 'meetings';
        }
        if (st.includes('nurture') || nst.includes('nurture')) {
          return 'nurture';
        }

        // 2. Next Action column
        if (act.includes('meet') || act.includes('meeting') || act.includes('demo') || act.includes('zoom')) {
          return 'meetings';
        }
        if (act.includes('nurture') || act.includes('switched off') || act.includes('after finding') || act.includes('later') || act.includes('hold')) {
          return 'nurture';
        }
        if (act.includes('not interested') || act.includes('hung up') || act.includes('rude') || act.includes("don't call") || act.includes('dont call')) {
          return 'not_interested';
        }

        // 3. Automatic 30-Day Follow-up Gap Rule (>= 30 days gap automatically goes to Nurture List)
        if (l.follow_up_dates) {
          const iso = normalizeToISO(l.follow_up_dates);
          if (iso) {
            const diffDays = Math.ceil((new Date(iso) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
            if (diffDays >= 30) return 'nurture';
          }
        }

        // 4. Notes column keyword fallback (Only if Status was NOT explicitly set above!)
        if (notes.includes('meeting') || notes.includes('demo') || notes.includes('zoom')) {
          return 'meetings';
        }
        if (notes.includes('nurture') || fu.includes('switched off') || fu.includes('after finding')) {
          return 'nurture';
        }
        if (notes.includes('hung up') || notes.includes('not interested') || fu.includes('not interested')) {
          return 'not_interested';
        }
        if (notes.includes('qualified')) {
          return 'qualified';
        }

        if (st === 'new') return 'new';
        return 'followups';
      };

      let filtered = allLeads;
      if (tab === 'new') {
        filtered = allLeads.filter(l => getCategory(l) === 'new');
      } else if (tab === 'contacted' || tab === 'followups') {
        filtered = allLeads.filter(l => getCategory(l) === 'followups');
      } else if (tab === 'meetings') {
        filtered = allLeads.filter(l => getCategory(l) === 'meetings');
      } else if (tab === 'qualified') {
        filtered = allLeads.filter(l => getCategory(l) === 'qualified');
      } else if (tab === 'nurture') {
        filtered = allLeads.filter(l => getCategory(l) === 'nurture');
      } else if (tab === 'not_interested') {
        filtered = allLeads.filter(l => getCategory(l) === 'not_interested');
      } else if (tab === 'won') {
        filtered = allLeads.filter(l => getCategory(l) === 'won');
      } else if (tab === 'lost') {
        filtered = allLeads.filter(l => getCategory(l) === 'lost');
      } else if (tab === 'today') {
        filtered = allLeads.filter(l => {
          const fuISO = normalizeToISO(l.follow_up_dates);
          return fuISO === todayStr;
        });
      } else if (tab === 'overdue') {
        filtered = allLeads.filter(l => {
          const fuISO = normalizeToISO(l.follow_up_dates);
          const cat = getCategory(l);
          if (cat === 'won' || cat === 'lost' || cat === 'not_interested') return false;
          return fuISO && fuISO < todayStr;
        });
      } else if (tab === 'reachout') {
        filtered = allLeads.filter(l => l.reachout_date && l.reachout_date.trim() !== '');
      } else if (tab === 'needs_new_number') {
        filtered = allLeads.filter(l => l.needs_new_number === true || l.number_status === 'needs_number' || (l.notes && (l.notes.toLowerCase().includes('wrong number') || l.notes.toLowerCase().includes('not working') || l.notes.toLowerCase().includes('switched off') || l.notes.toLowerCase().includes('find number'))));
      }

      let todayCount = 0;
      let overdueCount = 0;
      allLeads.forEach(l => {
        const fuISO = normalizeToISO(l.follow_up_dates);
        const cat = getCategory(l);
        if (fuISO) {
          if (fuISO === todayStr) {
            todayCount++;
          } else if (fuISO < todayStr && cat !== 'won' && cat !== 'lost' && cat !== 'not_interested') {
            overdueCount++;
          }
        }
      });

      const totalCount = allLeads.length;
      const notInterestedCount = allLeads.filter(l => getCategory(l) === 'not_interested').length;
      const nurtureCount = allLeads.filter(l => getCategory(l) === 'nurture').length;
      const qualifiedCount = allLeads.filter(l => getCategory(l) === 'qualified').length;
      const meetingsCount = allLeads.filter(l => getCategory(l) === 'meetings').length;
      const newLeadsCount = allLeads.filter(l => getCategory(l) === 'new').length;
      const followupsCount = allLeads.filter(l => getCategory(l) === 'followups').length;
      const contactedCount = followupsCount;
      const needsNewNumberCount = allLeads.filter(l => l.needs_new_number === true || l.number_status === 'needs_number' || (l.notes && (l.notes.toLowerCase().includes('wrong number') || l.notes.toLowerCase().includes('not working') || l.notes.toLowerCase().includes('switched off') || l.notes.toLowerCase().includes('find number')))).length;

      const responsePayload = {
        success: true,
        total: totalCount,
        filteredTotal: filtered.length,
        leads: filtered,
        kpis: {
          totalLeads: totalCount,
          followupsCount,
          nurtureCount,
          notInterestedCount,
          meetingsCount,
          qualifiedCount,
          contactedCount,
          newLeadsCount,
          todayCount,
          overdueCount,
          needsNewNumberCount
        }
      };

      return res.status(200).json(responsePayload);
    } catch (err) {
      console.error('API /leads GET error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  } else if (req.method === 'POST') {
    try {
      const payload = { ...req.body };
      if (payload.follow_up_dates) payload.follow_up_dates = normalizeToIndianDate(payload.follow_up_dates) || payload.follow_up_dates;
      if (payload.reachout_date) payload.reachout_date = normalizeToIndianDate(payload.reachout_date) || payload.reachout_date;
      if (payload.date_added) payload.date_added = normalizeToIndianDate(payload.date_added) || payload.date_added;

      const lead = new Lead(payload);
      await lead.save();

      cacheService.flush();

      return res.status(201).json({ success: true, lead });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
