import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import { checkAndSendReminders } from '../../../lib/reminderService';
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
      const updated = await Lead.findByIdAndUpdate(id, req.body, { new: true });
      cacheService.flush();
      checkAndSendReminders();

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
