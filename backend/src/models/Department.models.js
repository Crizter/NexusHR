import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    orgId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Organization',
      required: [true, 'orgId (tenant) is required'],
    },
    name: {
      type:     String,
      required: [true, 'Department name is required'],
      trim:     true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Unique department name per org
departmentSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.model('Department', departmentSchema);