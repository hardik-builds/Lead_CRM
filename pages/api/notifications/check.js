import dbConnect from '../../../lib/dbConnect';
import { checkAndSendReminders } from '../../../lib/reminderService';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'POST') {
    try {
      const newAlerts = await checkAndSendReminders();
      return res.status(200).json({ success: true, newAlertsCount: newAlerts.length, alerts: newAlerts });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
