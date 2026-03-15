import 'dotenv/config';
import mongoose   from 'mongoose';
import bcrypt     from 'bcryptjs';
import SuperAdmin from '../models/SuperAdmin.models.js';

const SEED_EMAIL    = "superadmin@nexus.com"
const SEED_PASSWORD = "password@123"
const SALT_ROUNDS   = 12;

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Seed] Connected to MongoDB');

    const existing = await SuperAdmin.findOne({ email: SEED_EMAIL });
    if (existing) {
      console.log(`[Seed] Super Admin "${SEED_EMAIL}" already exists — skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

    await SuperAdmin.create({
      email:        SEED_EMAIL,
      passwordHash,
      profile: { firstName: 'Super', lastName: 'Admin' },
    });
    console.log('super admin seeded');

  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[Seed] Disconnected.');
  }
};

seed();