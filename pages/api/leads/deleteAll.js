import dbConnect from '../../../lib/dbConnect';
import Lead from '../../../models/Lead';
import cacheService from '../../../lib/cacheService';
import { verifyRequestAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  // Enforce JWT Authentication for Universal Delete
  const auth = verifyRequestAuth(req);
  if (!auth.valid) {
    return res.status(401).json({ success: false, error: auth.error });
  }

  await dbConnect();

  if (req.method === 'DELETE') {
    try {
      const result = await Lead.deleteMany({});
      cacheService.flush();

      console.log(`[Universal Delete]: Deleted ${result.deletedCount} leads from MongoDB.`);
      return res.status(200).json({ success: true, deletedCount: result.deletedCount });
    } catch (err) {
      console.error('Delete all error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
