import dbConnect from '../../../lib/dbConnect';
import Reminder from '../../../models/Reminder';
import { istToUTC } from '../../../lib/reminderService';

export default async function handler(req, res) {
  await dbConnect();
  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const updateData = { ...req.body };

      // If date or time changed, recompute triggerAtUTC
      if (updateData.reminderDateIST && updateData.reminderTimeIST) {
        const newTrigger = istToUTC(updateData.reminderDateIST, updateData.reminderTimeIST);
        if (!newTrigger || isNaN(newTrigger.getTime())) {
          return res.status(400).json({ success: false, error: 'Invalid date/time format.' });
        }
        if (newTrigger < new Date()) {
          return res.status(400).json({ success: false, error: 'Reminder time is in the past.' });
        }
        updateData.triggerAtUTC = newTrigger;
        updateData.status = 'pending'; // Reset to pending if rescheduled
      }

      const updated = await Reminder.findByIdAndUpdate(id, updateData, { new: true });
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Reminder not found' });
      }
      return res.status(200).json({ success: true, reminder: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const deleted = await Reminder.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Reminder not found' });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
