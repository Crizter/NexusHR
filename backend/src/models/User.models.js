import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "orgId (tenant) is required"],
      index: true,
    },
    displayId: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ["super_admin", "hr_manager", "employee", "manager"],
      required: [true, "Role is required"],
      default: "employee",
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      contactNumber: { type: String, trim: true },
      avatarUrl: { type: String, trim: true },
    },
    financial: {
      baseSalary: { type: Number, default: 0 },
      currency: { type: String, default: "USD" },
      // ── Static Overrides (Overrides the Department settings if not null) ──
      customTaxPercentage: {
        type: Number,
        default: null,
      },
      customHealthInsurance: {
        type: Number,
        default: null,
      },

      // ── Monthly Variables (Injected by HR, wiped by Worker after payroll) ──
      bonusThisMonth: {
        type: Number,
        default: 0,
      },
      unpaidLeaveDaysThisMonth: {
        type: Number,
        default: 0,
      },
    },
    leaveBalances: {
      casual: { type: Number, default: 12 },
      sick: { type: Number, default: 10 },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    zoomAuth: {
      accessToken: { type: String },
      refreshToken: { type: String },
      expiresAt: { type: Date },
      zoomUserId: { type: String }
    }
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Unique email per org (tenant isolation)
userSchema.index({ orgId: 1, email: 1 }, { unique: true });
// Fast department-level HR lookups
userSchema.index({ orgId: 1, departmentId: 1 });

// Supports both Pipeline A and the Retention Cohorts pipeline
userSchema.index({ orgId: 1, isDeleted: 1, createdAt: 1 });

userSchema.index({
  orgId:                1,
  isDeleted:            1,
  'profile.firstName':  1,
  'profile.lastName':   1,
  email:                1,
  displayId:            1,
});

userSchema.index({ orgId: 1, isDeleted: 1, departmentId: 1, _id: -1 });

export default mongoose.model("User", userSchema);
