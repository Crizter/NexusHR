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
    
    payrollSettings: {
    // How much tax to deduct if the user doesn't have a custom rate (e.g., 10 for 10%)
    defaultTaxPercentage: { 
      type: Number, 
      default: 0 
    }, 
    // Fixed amount deducted for company health plans (e.g., 50 for $50)
    healthInsuranceFlatRate: { 
      type: Number, 
      default: 0 
    }, 
    // How much to penalize per day of unpaid leave (e.g., 100 for $100/day)
    unpaidLeaveDeductionPerDay: { 
      type: Number, 
      default: 0 
    }
  },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Unique department name per org
departmentSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.model('Department', departmentSchema);