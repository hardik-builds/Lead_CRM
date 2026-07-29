import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import { normalizeToISO } from '../../../lib/reminderService';
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
          let rawScore = parseInt(rawScoreStr, 10);
          if (!isNaN(rawScore) && rawScore > 10) {
            rawScore = Math.min(Math.max(Math.round(rawScore / 10), 1), 10);
          }
          const scoreVal = (!isNaN(rawScore) && rawScore > 0) ? rawScore : undefined;

          const rawReachout = getRowValue(row, ['outreach date', 'outreach_date', 'reachout date', 'reachout_date', 'reach out date', 'date of outreach', 'contacted date']);
          const rawFollowup = getRowValue(row, ['Follow up date', 'follow_up_dates', 'Follow up dates', 'Followup Date', 'Follow-up Date', 'Next Followup', 'Followup', 'Follow up']);
          const rawDateAdded = getRowValue(row, ['Date Added', 'date_added', 'Added Date', 'Created Date', 'Date']);

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
            date_added: normalizeToISO(rawDateAdded) || new Date().toISOString().split('T')[0],
            assigned_to: String(getRowValue(row, ['Assigned To', 'assigned_to', 'Agent', 'Sales Rep', 'Owner']) || 'Sales Team'),
            status: String(getRowValue(row, ['Status', 'status', 'Lead Status', 'Stage']) || 'New'),
            notes: String(getRowValue(row, ['Notes', 'notes', 'Note', 'Comments', 'Remarks', 'History']) || ''),
            score_of_client: scoreVal,
            reachout_date: normalizeToISO(rawReachout) || '',
            new_status: String(getRowValue(row, ['New status', 'new_status', 'Sub Status', 'Sub_Status']) || ''),
            next_action: String(getRowValue(row, ['Next Action', 'next_action', 'Action', 'Action Item']) || ''),
            follow_up_dates: normalizeToISO(rawFollowup) || ''
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
