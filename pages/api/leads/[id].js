import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import { checkAndSendReminders, normalizeToISO, normalizeToIndianDate } from '../../../lib/reminderService';
import { verifyRequestAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  const auth = verifyRequestAuth(req);
  if (!auth.valid) {
    return res.status(401).json({ success: false, error: auth.error });
  }

  const { id } = req.query;
  await dbConnect();

  if (req.method === 'PUT') {
    try {
      const existing = await Lead.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
      }

      const updateData = { ...req.body };
      const rawPassedLog = updateData.activity_log;
      delete updateData.activity_log; // Remove from $set to prevent path conflict with $push

      if (updateData.follow_up_dates !== undefined && updateData.follow_up_dates !== '') {
        updateData.follow_up_dates = normalizeToIndianDate(updateData.follow_up_dates) || updateData.follow_up_dates;
      }
      if (updateData.reachout_date !== undefined && updateData.reachout_date !== '') {
        updateData.reachout_date = normalizeToIndianDate(updateData.reachout_date) || updateData.reachout_date;
      }
      if (updateData.date_added !== undefined && updateData.date_added !== '') {
        updateData.date_added = normalizeToIndianDate(updateData.date_added) || updateData.date_added;
      }

      // Build activity log entry with FULL CONTEXT diffs
      const newActivity = [];

      // Extract any new activity item passed from frontend (e.g. Follow-up Completed)
      if (Array.isArray(rawPassedLog) && rawPassedLog.length > 0) {
        const existingCount = existing.activity_log ? existing.activity_log.length : 0;
        const newPassed = rawPassedLog.slice(existingCount);
        newPassed.forEach(item => {
          if (item && item.action) {
            newActivity.push(item);
          }
        });
      }

      // Comprehensive Field-by-Field Diff Comparison
      const fieldsToTrack = [
        { key: 'status', label: 'Status' },
        { key: 'new_status', label: 'New Status' },
        { key: 'follow_up_dates', label: 'Follow-up Date' },
        { key: 'reachout_date', label: 'Reachout Date' },
        { key: 'notes', label: 'Notes' },
        { key: 'company', label: 'Company Name' },
        { key: 'contact', label: 'Contact Phone' },
        { key: 'email', label: 'Email Address' },
        { key: 'founder', label: 'Founder Name' },
        { key: 'city', label: 'City' },
        { key: 'locations', label: 'Locations' },
        { key: 'score_of_client', label: 'Client Score' },
        { key: 'next_action', label: 'Next Action' },
        { key: 'pain_point', label: 'Pain Point' },
        { key: 'assigned_to', label: 'Assigned Agent' },
        { key: 'source', label: 'Source' }
      ];

      fieldsToTrack.forEach(({ key, label }) => {
        if (updateData[key] !== undefined) {
          const oldVal = existing[key] !== undefined && existing[key] !== null ? String(existing[key]).trim() : '';
          const newVal = String(updateData[key]).trim();

          if (oldVal !== newVal) {
            const author = updateData.assigned_to || existing.assigned_to || 'Sales Team';

            if (key === 'notes') {
              newActivity.push({
                timestamp: new Date(),
                action: 'Notes Updated',
                field: 'notes',
                details: oldVal ? `Updated notes from "${oldVal}" to "${newVal}"` : `Initial note added: "${newVal}"`,
                oldValue: oldVal || '(empty)',
                newValue: newVal || '(empty)',
                performedBy: author
              });
            } else {
              newActivity.push({
                timestamp: new Date(),
                action: `${label} Updated`,
                field: key,
                details: oldVal ? `Changed ${label} from '${oldVal}' to '${newVal}'` : `Set ${label} to '${newVal}'`,
                oldValue: oldVal || '(empty)',
                newValue: newVal || '(empty)',
                performedBy: author
              });
            }
          }
        }
      });

      const updateQuery = { $set: updateData };
      if (newActivity.length > 0) {
        updateQuery.$push = { activity_log: { $each: newActivity } };
      }

      const updated = await Lead.findByIdAndUpdate(id, updateQuery, { new: true });
      cacheService.flush();

      return res.status(200).json({ success: true, lead: updated });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      await Lead.findByIdAndDelete(id);
      cacheService.flush();

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
