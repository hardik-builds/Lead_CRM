import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import { normalizeToIndianDate } from '../../../lib/reminderService';
import xlsx from 'xlsx';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Fuzzy Header Extraction Helper
function getRowValue(row, possibleKeys) {
  if (!row || typeof row !== 'object') return '';
  const rowKeys = Object.keys(row);
  for (const targetKey of possibleKeys) {
    const targetNorm = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of rowKeys) {
      const keyNorm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (keyNorm === targetNorm && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return row[key];
      }
    }
  }
  return '';
}

// Smart Status Normalizer: Scans Status, New Status, Notes, Next Action, and Followup Date columns for keywords
function normalizeStatus(rawStatus, notesText = '', actionText = '', followupText = '', newStatusText = '') {
  const combined = (String(rawStatus || '') + ' ' + String(newStatusText || '') + ' ' + String(notesText || '') + ' ' + String(actionText || '') + ' ' + String(followupText || '')).toLowerCase();
  const act = String(actionText || '').toLowerCase();
  const nst = String(newStatusText || '').toLowerCase();

  // 1. Meeting Scheduled (Priority 1: if meet/meeting in next_action, status, new_status, or notes)
  if (act.includes('meet') || combined.includes('meeting') || combined.includes('demo') || combined.includes('zoom')) {
    return 'Meeting Scheduled';
  }

  // 2. Explicit Nurture Directive in Next Action / Notes / New Status -> Nurture List!
  if (act.includes('nurture') || nst.includes('nurture') || combined.includes('switched off') || combined.includes('after finding') || combined.includes('later') || combined.includes('hold')) {
    return 'Nurture';
  }

  // 3. Not Interested / Rude / Hung Up triggers in any column -> Not Interested!
  if (combined.includes('hung up') || combined.includes('rude') || combined.includes("don't call") || combined.includes('dont call') || combined.includes('not interested') || combined.includes('no interest') || combined.includes('reject')) {
    return 'Not Interested';
  }

  if (combined.includes('qualifi')) {
    return 'Qualified';
  }
  if (combined.includes('won') || combined.includes('closed') || combined.includes('converted')) {
    return 'Won';
  }
  if (combined.includes('lost') || combined.includes('dead') || combined.includes('dropped')) {
    return 'Lost';
  }

  return 'Contacted';
}

function getTodayIndianStr() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${now.getFullYear()}`;
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'POST') {
    try {
      const form = formidable({ multiples: false });

      form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        const fileObj = files.file ? (Array.isArray(files.file) ? files.file[0] : files.file) : null;
        if (!fileObj) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const buffer = fs.readFileSync(fileObj.filepath || fileObj.path);
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

        const docs = rawRows.map(row => {
          const rawScoreStr = getRowValue(row, ['Score of client', 'score_of_client', 'Client Score', 'Score', 'Rating']);
          const scoreVal = rawScoreStr !== undefined && rawScoreStr !== null && String(rawScoreStr).trim() !== '' ? String(rawScoreStr).trim() : '5';

          const rawReachout = getRowValue(row, ['outreach date', 'outreach_date', 'reachout date', 'reachout_date', 'reach out date', 'date of outreach', 'contacted date']);
          const rawFollowup = getRowValue(row, ['Follow up date', 'follow_up_dates', 'Follow up dates', 'Followup Date', 'Follow-up Date', 'Next Followup', 'Followup', 'Follow up']);
          const rawDateAdded = getRowValue(row, ['Date Added', 'date_added', 'Added Date', 'Created Date', 'Date']);
          const rawStatus = getRowValue(row, ['Status', 'status', 'Lead Status', 'Stage']);
          const rawNewStatus = getRowValue(row, ['New status', 'new_status', 'Sub Status', 'Sub_Status']);
          const rawNotes = getRowValue(row, ['Notes', 'notes', 'Note', 'Comments', 'Remarks', 'History']);
          const rawNextAction = getRowValue(row, ['Next Action', 'next_action', 'Action', 'Action Item']);

          const finalStatus = normalizeStatus(rawStatus, rawNotes, rawNextAction, rawFollowup, rawNewStatus);
          const finalFollowup = normalizeToIndianDate(rawFollowup || rawNextAction) || '';

          return {
            company: String(getRowValue(row, ['Company', 'company', 'Company Name', 'Business Name', 'Firm']) || 'Unnamed'),
            city: String(getRowValue(row, ['City', 'city', 'Location', 'Town']) || ''),
            locations: String(getRowValue(row, ['Locations', 'locations', 'Address', 'Location / Address']) || ''),
            founder: String(getRowValue(row, ['Founder', 'founder', 'Founder Name', 'Client Name', 'Name']) || ''),
            linkedin: String(getRowValue(row, ['LinkedIn', 'linkedin', 'LinkedIn Profile', 'LinkedIn URL']) || ''),
            contact: String(getRowValue(row, ['Phone', 'Contact', 'contact', 'Mobile', 'Phone Number']) || ''),
            email: String(getRowValue(row, ['Email', 'email', 'Email Address', 'Mail']) || ''),
            pain_point: String(getRowValue(row, ['Pain Point', 'pain_point', 'Pain Points', 'Requirement', 'Problem']) || ''),
            source: String(getRowValue(row, ['Source', 'source', 'Lead Source', 'Channel']) || 'Direct'),
            date_added: normalizeToIndianDate(rawDateAdded) || getTodayIndianStr(),
            assigned_to: String(getRowValue(row, ['Assigned To', 'assigned_to', 'Agent', 'Sales Rep', 'Owner']) || 'Sales Team'),
            status: finalStatus,
            notes: String(rawNotes || ''),
            score_of_client: scoreVal,
            reachout_date: normalizeToIndianDate(rawReachout) || '',
            new_status: String(rawNewStatus || ''),
            next_action: String(rawNextAction || ''),
            follow_up_dates: finalFollowup
          };
        });

        const inserted = await Lead.insertMany(docs);
        cacheService.flush();

        return res.status(200).json({ success: true, importedCount: inserted.length });
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
