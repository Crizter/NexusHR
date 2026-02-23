import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    orgId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Organization',
      required: [true, 'orgId (tenant) is required'],
    },
    name: {
      type:     String,
      required: [true, 'Holiday name is required'],
      trim:     true,
    },
    date: {
      type:     Date,
      required: [true, 'Holiday date is required'],
    },
    type: {
      type:    String,
      enum:    ['public', 'optional'],
      default: 'public',
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Fetch upcoming holidays for a specific org efficiently
holidaySchema.index({ orgId: 1, date: 1 });

export default mongoose.model('Holiday', holidaySchema);