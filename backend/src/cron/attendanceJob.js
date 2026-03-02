import cron             from 'node-cron';
import mongoose         from 'mongoose';
import User             from '../models/User.models.js';
import ReportAttendanceStat from '../models/analytics/ReportAttendanceStat.models.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helper — advance a Date by N days, returning a new Date (no mutation)
// ─────────────────────────────────────────────────────────────────────────────
const addDays = (date, n) => new Date(
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + n)
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper — format a Date as "YYYY-MM-DD" using UTC parts
// We always use UTC to stay consistent with MongoDB's date storage
// ─────────────────────────────────────────────────────────────────────────────
const toDateString = (date) => {
  const y  = date.getUTCFullYear();
  const m  = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d  = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// runAttendancePipelineForDate
//
// Runs the full aggregation for ONE specific date across ALL organisations.
// Uses $merge so it is safe to re-run — idempotent upsert.
//
// @param {Date}   targetDate   UTC midnight of the date to calculate
// @param {string} dateString   Pre-formatted "YYYY-MM-DD" for the _id
// @param {number} year         UTC year  (injected into $merge document)
// @param {number} month        UTC month (injected into $merge document)
// ─────────────────────────────────────────────────────────────────────────────
const runAttendancePipelineForDate = async (targetDate, dateString, year, month) => {
  const dayStart = new Date(Date.UTC(year, month - 1, targetDate.getUTCDate(), 0, 0, 0));
  const dayEnd   = new Date(Date.UTC(year, month - 1, targetDate.getUTCDate() + 1, 0, 0, 0));

  await User.aggregate([
    { $match: { isDeleted: false } },
    {
      $lookup: {
        from: 'leaverequests',
        let:  { userId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq:  ['$employeeId', '$$userId']  },
                  { $eq:  ['$status',     'approved']  },
                  { $lt:  ['$dates.startDate', dayEnd]  },
                  { $gte: ['$dates.endDate',   dayStart] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: 'activeLeaves',
      },
    },
    { $addFields: { isOnLeave: { $gt: [{ $size: '$activeLeaves' }, 0] } } },
    {
      $group: {
        _id:       { orgId: '$orgId', departmentId: '$departmentId' },
        headcount: { $sum: 1 },
        onLeave:   { $sum: { $cond: ['$isOnLeave', 1, 0] } },
        present:   { $sum: { $cond: ['$isOnLeave', 0, 1] } },
      },
    },
    {
      $group: {
        _id:            '$_id.orgId',
        totalHeadcount: { $sum: '$headcount' },
        present:        { $sum: '$present'   },
        onLeave:        { $sum: '$onLeave'   },
        departmentBreakdown: {
          $push: {
            departmentId: '$_id.departmentId',
            headcount:    '$headcount',
            present:      '$present',
            onLeave:      '$onLeave',
          },
        },
      },
    },
    {
      $addFields: {
        absent: {
          $subtract: ['$totalHeadcount', { $add: ['$present', '$onLeave'] }],
        },
        attendanceRate: {
          $cond: {
            if:   { $gt: ['$totalHeadcount', 0] },
            then: { $multiply: [{ $divide: ['$present', '$totalHeadcount'] }, 100] },
            else: 0,
          },
        },
        // Build compound _id in $addFields to preserve ObjectId type
        newId: {
          orgId:  '$_id',
          date:   dateString,
          year:   year,
          month:  month,
        },
      },
    },
    {
      $project: {
        _id: '$newId',      
        metrics: {
          totalHeadcount: '$totalHeadcount',
          present:        '$present',
          onLeave:        '$onLeave',
          absent:         '$absent',
          attendanceRate: { $round: ['$attendanceRate', 2] },
        },
        departmentBreakdown: 1,
        lastCalculatedAt:    '$$NOW',
      },
    },
    {
      $merge: {
        into:           'report_attendance_stats',
        on:             '_id',
        whenMatched:    'replace',
        whenNotMatched: 'insert',
      },
    },
  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// attendanceJob — self-healing cron
//
// Runs daily at 02:00 AM server time.
//
// Self-healing logic:
//   1. Query the materialized view for the most recent document.
//   2. If found, start from lastReport.date + 1 day (catches up missed days).
//   3. If not found (first run / fresh DB), start from 7 days ago.
//   4. Loop day by day until yesterday, running the pipeline for each date.
//
// This means if the server was down for 3 days, the next run will
// automatically back-fill all 3 missing days.
// ─────────────────────────────────────────────────────────────────────────────
export const attendanceJob = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('[AttendanceJob]  Starting daily attendance aggregation...');

    try {
      // ── Determine yesterday (UTC midnight) ───────────────────────────────
      const now       = new Date();
      const yesterday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
      );

      // ── Self-healing: find the last processed date ────────────────────────
      const lastReport = await ReportAttendanceStat
        .findOne({})
        .sort({ '_id.date': -1 })
        .select('_id.date')
        .lean();

      let currentDate;

      if (lastReport) {
        // Resume from the day after the last processed date
        const lastDate = new Date(lastReport._id.date + 'T00:00:00.000Z');
        currentDate    = addDays(lastDate, 1);
        console.log(
          `[AttendanceJob] Last processed date: ${lastReport._id.date} — resuming from ${toDateString(currentDate)}`
        );
      } else {
        // First run — back-fill the last 7 days
        currentDate = addDays(yesterday, -6);
        console.log(
          `[AttendanceJob] No previous records found — back-filling from ${toDateString(currentDate)}`
        );
      }

      // ── Self-healing loop: process every missing day up to yesterday ──────
      let daysProcessed = 0;

      while (currentDate <= yesterday) {
        const dateString = toDateString(currentDate);
        const year       = currentDate.getUTCFullYear();
        const month      = currentDate.getUTCMonth() + 1;   // 1-indexed

        console.log(`[AttendanceJob] Processing date: ${dateString}`);

        try {
          await runAttendancePipelineForDate(currentDate, dateString, year, month);
          console.log(`[AttendanceJob]  Done: ${dateString}`);
          daysProcessed++;
        } catch (pipelineErr) {
          // Log per-date failure but continue the loop —
          // one bad date should not abort back-fill of other dates
          console.error(
            `[AttendanceJob]  Pipeline failed for ${dateString}: ${pipelineErr.message}`
          );
          console.error(pipelineErr.stack);
        }

        // Advance to the next day
        currentDate = addDays(currentDate, 1);
      }

      console.log(
        `[AttendanceJob]  Completed — ${daysProcessed} day(s) processed`
      );

    } catch (err) {
      console.error(`[AttendancxjeJob]  Fatal error: ${err.message}`);
      console.error(err.stack);
    }
  });

};

export { runAttendancePipelineForDate, addDays, toDateString };
