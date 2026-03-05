import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema(
  {
    orgId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Organization',
      required: [true, 'orgId (tenant) is required'],
    },
    employeeId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'employeeId is required'],
    },
    departmentId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Department',
      required: [true, 'departmentId is required'],
    },

    // ── Denormalized for UI speed ──────────────────────────────────────────
    employeeName: {
      type:     String,
      required: [true, 'employeeName is required'],
      trim:     true,
    },

    type: {
      type:     String,
      enum:     ['casual_leave', 'sick_leave'],
      required: [true, 'Leave type is required'],
    },
    status: {
      type:    String,
      enum:    ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },

    dates: {
      startDate: { type: Date,   required: true },
      endDate:   { type: Date,   required: true },
      totalDays: { type: Number, required: true, min: 1 },
    },

    reason: {
      type:     String,
      required: [true, 'Reason is required'],
      trim:     true,
    },

    workflow: {
      actionedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
      actionedAt: { type: Date   },
      comments:   { type: String, trim: true },
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Employee's personal leave history (newest first)
leaveRequestSchema.index({ orgId: 1, employeeId: 1, createdAt: -1 });
// HR filtering by department + status (e.g., "all pending in Engineering")
leaveRequestSchema.index({ orgId: 1, departmentId: 1, status: 1 });
// EMPLOYEE ALL LEAVES WITHIN THE YEAR 
leaveRequestSchema.index({orgId:1, employeeId:1,status:1,  "dates.startDate": 1, "dates.endDate": 1 });
// ALL EMPLOYEES  BY STATUS 
leaveRequestSchema.index({orgId:1, status:1 }) ;
// Supports the Heatmap pipeline perfectly
leaveRequestSchema.index({ orgId: 1, status: 1, 'dates.startDate': 1, 'dates.endDate': 1 });

export default mongoose.model('LeaveRequest', leaveRequestSchema);