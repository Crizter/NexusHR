import 'dotenv/config';
import mongoose    from 'mongoose';
import connectDB   from '../config/db.js';
import Organization from '../models/Organization.models.js';

const runMigration = async () => {
  try {
    await connectDB();
    console.log('[Migration] Connected to MongoDB');

    const result = await Organization.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );

    console.log(`[Migration] Done — ${result.modifiedCount} organization(s) updated.`);

  } catch (err) {
    console.error('[Migration] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('[Migration] Connection closed.');
  }
};

runMigration();