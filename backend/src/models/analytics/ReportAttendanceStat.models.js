import mongoose from 'mongoose';

const { Schema } = mongoose;

// ── Compound _id: { orgId, date, month, year } ───────────────────────────────
// $merge upsert key = _id → O(log n) point lookup, no separate unique index needed
const attendanceStatSchema = new Schema(
  {
    _id: {
      orgId:  { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
      date:   { type: String, required: true },   // "YYYY-MM-DD"
      month:  { type: Number, required: true },   // 2
      year:   { type: Number, required: true },   // 2026
    },

    metrics: {
      totalHeadcount: { type: Number, default: 0, min: 0 },
      present:        { type: Number, default: 0, min: 0 },
      onLeave:        { type: Number, default: 0, min: 0 },
      absent:         { type: Number, default: 0, min: 0 },
      // Pre-calculated percentage — avoids division on every frontend read
      attendanceRate: { type: Number, default: 0, min: 0, max: 100 },
    },

    departmentBreakdown: [
      {
        _id:            false,           // no subdoc _id noise
        departmentId:   { type: Schema.Types.ObjectId, ref: 'Department' },
        departmentName: { type: String },
        headcount:      { type: Number, default: 0 },
        present:        { type: Number, default: 0 },
        onLeave:        { type: Number, default: 0 },
      },
    ],

    lastCalculatedAt: { type: Date, default: Date.now },  // fn ref, not Date.now()
  },
  {
    _id:        false,   // supply compound _id manually
    versionKey: false,   // no __v on a materialized view
    collection: 'report_attendance_stats',
  }
);

// ── Indexes for dashboard range queries (last 30 days for an org) ─────────────
attendanceStatSchema.index({ '_id.orgId': 1, '_id.date': -1 });
attendanceStatSchema.index({ '_id.orgId': 1, '_id.year': 1, '_id.month': 1 });

export default mongoose.model('ReportAttendanceStat', attendanceStatSchema);