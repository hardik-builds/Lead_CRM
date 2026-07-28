import dbConnect from '../../../lib/dbConnect';
import Notification from '../../../models/Notification';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const notifications = await Notification.find().sort({ timestamp: -1 }).limit(100);
      return res.status(200).json({ success: true, notifications });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
