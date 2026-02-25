import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    orgId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Organization',
      required: [true, 'orgId (tenant) is required'],
      index:    true,
    },
    displayId: {
      type:  String,
      trim:  true,
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      trim:      true,
      lowercase: true,
    },
    passwordHash: {
      type:   String,
      select: false,        // Never returned in queries by default
    },
    role: {
      type:     String,
      enum:     ['super_admin', 'hr_manager', 'employee','manager'],
      required: [true, 'Role is required'],
      default:  'employee',
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Department',
    },
    profile: {
      firstName:     { type: String, trim: true },
      lastName:      { type: String, trim: true },
      contactNumber: { type: String, trim: true },
      avatarUrl:     { type: String, trim: true },
    },
    financial: {
      baseSalary: { type: Number, default: 0    },
      currency:   { type: String, default: 'USD' },
    },
    leaveBalances: {
      casual: { type: Number, default: 12 },
      sick:   { type: Number, default: 10 },
    },
    isDeleted: {
      type:    Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
  },  
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Unique email per org (tenant isolation)
userSchema.index({ orgId: 1, email: 1 }, { unique: true });
// Fast department-level HR lookups
userSchema.index({ orgId: 1, departmentId: 1 });


export default mongoose.model('User', userSchema);