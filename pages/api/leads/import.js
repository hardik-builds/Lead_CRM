import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import xlsx from 'xlsx';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

function formatExcelDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return String(val);
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
          const rawScore = parseInt(row['score of client  '] || row['score_of_client'], 10);
          const scoreVal = (!isNaN(rawScore) && rawScore > 0) ? rawScore : undefined;

          return {
            company: row['Company'] || row['company'] || 'Unnamed',
            city: row['City'] || row['city'] || '',
            locations: row['Locations'] || row['locations'] || '',
            founder: row['Founder'] || row['founder'] || '',
            linkedin: row['LinkedIn'] || row['linkedin'] || '',
            contact: String(row['Phone'] || row['Contact'] || row['contact'] || ''),
            email: row['Email'] || row['email'] || '',
            pain_point: row['Pain Point'] || row['pain point'] || '',
            source: row['Source'] || row['source'] || 'Direct',
            date_added: formatExcelDate(row['Date Added']) || new Date().toISOString().split('T')[0],
            assigned_to: row['Assigned To'] || 'Sales Team',
            status: row['Status'] || row['status'] || 'New',
            notes: row['Notes'] || '',
            score_of_client: scoreVal,
            reachout_date: formatExcelDate(row['outreach date '] || row['Reachout Date']),
            new_status: row['New status'] || '',
            next_action: row['Next Action'] || '',
            follow_up_dates: formatExcelDate(row['Follow up date'] || row['Follow up dates'])
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
