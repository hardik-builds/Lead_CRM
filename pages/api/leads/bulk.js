import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import { checkAndSendReminders, normalizeToIndianDate } from '../../../lib/reminderService';
import { verifyRequestAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  const auth = verifyRequestAuth(req);
  if (!auth.valid) {
    return res.status(401).json({ success: false, error: auth.error });
  }

  await dbConnect();

  if (req.method === 'POST') {
    try {
      const { leadIds, action, status, follow_up_dates, assigned_to } = req.body;
      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ success: false, error: 'No lead IDs provided for bulk action' });
      }

      if (action === 'update_status') {
        const updatePayload = { status };
        if ((status || '').toLowerCase().includes('not interested')) {
          updatePayload.new_status = 'Nurture (Not Interested)';
        }
        await Lead.updateMany(
          { _id: { $in: leadIds } },
          {
            $set: updatePayload,
            $push: {
              activity_log: {
                timestamp: new Date(),
                action: 'Bulk Status Update',
                details: `Status updated to '${status}' via Bulk Actions`,
                performedBy: 'Sales Team'
              }
            }
          }
        );
      } else if (action === 'reschedule') {
        const formattedDate = normalizeToIndianDate(follow_up_dates) || follow_up_dates;
        await Lead.updateMany(
          { _id: { $in: leadIds } },
          {
            $set: { follow_up_dates: formattedDate },
            $push: {
              activity_log: {
                timestamp: new Date(),
                action: 'Bulk Reschedule',
                details: `Follow-up date updated to '${formattedDate}' via Bulk Actions`,
                performedBy: 'Sales Team'
              }
            }
          }
        );
      } else if (action === 'reassign') {
        await Lead.updateMany(
          { _id: { $in: leadIds } },
          {
            $set: { assigned_to },
            $push: {
              activity_log: {
                timestamp: new Date(),
                action: 'Bulk Reassigned',
                details: `Assigned agent updated to '${assigned_to}' via Bulk Actions`,
                performedBy: 'Sales Team'
              }
            }
          }
        );
      } else if (action === 'delete') {
        await Lead.deleteMany({ _id: { $in: leadIds } });
      } else {
        return res.status(400).json({ success: false, error: 'Invalid bulk action' });
      }

      cacheService.flush();

      return res.status(200).json({ success: true, count: leadIds.length });
    } catch (err) {
      console.error('Bulk action error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
