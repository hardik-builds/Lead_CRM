import dbConnect from '../../../lib/dbConnect';
import Setting from '../../../models/Setting';
import { verifyRequestAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  const auth = verifyRequestAuth(req);
  if (!auth.valid) {
    return res.status(401).json({ success: false, error: auth.error });
  }

  await dbConnect();

  if (req.method === 'GET') {
    try {
      let setting = await Setting.findOne();
      if (!setting) {
        setting = await Setting.create({
          registeredEmail: process.env.REGISTERED_EMAIL || 'user@gmail.com'
        });
      }
      return res.status(200).json({ success: true, settings: setting });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  } else if (req.method === 'POST') {
    try {
      let setting = await Setting.findOne();
      if (!setting) {
        setting = await Setting.create(req.body);
      } else {
        Object.assign(setting, req.body);
        await setting.save();
      }
      return res.status(200).json({ success: true, settings: setting });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
