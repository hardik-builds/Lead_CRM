import mongoose from 'mongoose';
import { initReminderCron } from './reminderCron';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lead_management';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log('[MongoDB Connected Successfully]');
      
      // Automatically launch the autonomous 30-minute background cron scanner on DB connection
      try {
        initReminderCron();
      } catch (err) {
        console.error('Cron launch error:', err);
      }

      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
