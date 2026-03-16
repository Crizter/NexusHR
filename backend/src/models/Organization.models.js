import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Organization name is required'],
      trim:     true,
    },
    slug: {
      type:      String,
      required:  [true, 'Slug is required'],
      trim:      true,
      lowercase: true,
    },
    subscription: {
      plan: {
        type:    String,
        enum:    ['free', 'pro', 'enterprise'],
        default: 'free',
      },
      status: {
        type:    String,
        enum:    ['active', 'past_due'],
        default: 'active',
      },
      maxUsers: {
        type:    Number,
      default: 10,
      },
    },
    isActive: { 
        type: Boolean,
        default: true,
      },
    settings: {
      leavePolicy: {
        casualLeaves: { type: Number, default: 12 },
        sickLeaves:   { type: Number, default: 10 },
      },
      
      timezone: {
        type:    String,
        default: 'UTC',
      },
      payroll: { 
        currency : { 
          type: String, 
          default: 'USD',
        },
        payCycle: { 
          type: String,
          enum: ['monthly', 'bi-weekly'], 
          default: 'monthly',
        }, 
        taxId: { 
          type: String, 
          trim: true,
        }
      },
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
organizationSchema.index({ slug: 1 }, { unique: true });

export default mongoose.model('Organization', organizationSchema);