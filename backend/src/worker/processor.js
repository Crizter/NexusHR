import mongoose     from 'mongoose';
import User         from '../models/User.models.js';
import LeaveRequest from '../models/LeaveRequest.models.js';

// ─────────────────────────────────────────────────────────────────────────────
// WORKER 1 — updateMonthlyTrend(orgId, yearMonth)
//
// Runs TWO pipelines in parallel:
//   Pipeline A → User collection  → headcount + salary burn → $merge
//   Pipeline B → LeaveRequest     → daily heatmap + leaveDaysTaken → $merge
//
// Both pipelines write to the same compound _id document in monthlytrends.
// MongoDB $merge { whenMatched: "merge" } deep-merges the fields, so running
// both pipelines in parallel is safe — they touch different top-level keys.
// ─────────────────────────────────────────────────────────────────────────────
export const updateMonthlyTrend = async (orgId, yearMonth) => {
  const orgObjectId = new mongoose.Types.ObjectId(orgId);

  // Parse "YYYY-MM" into a date range for the leave pipeline filter
  const [year, month]    = yearMonth.split('-').map(Number);
  const periodStart      = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd        = new Date(Date.UTC(year, month,     1)); // exclusive upper bound

  await Promise.all([

    // ── Pipeline A: Headcount + Salary Burn ────────────────────────────────
    User.aggregate([
      // Step 1 — only active, non-deleted employees in this org
      {
        $match: {
          orgId:     orgObjectId,
          isDeleted: false,
        },
      },

      // Step 2 — compute totals entirely inside MongoDB
      {
        $group: {
          _id:             null,
          totalHeadcount:  { $sum: 1 },
          totalSalaryBurn: { $sum: '$earnings.baseSalary' },
        },
      },

      // Step 3 — reshape to match the Materialized View schema
      //          _id must be the compound key { orgId, month }
      {
        $project: {
          _id: {
            orgId:  orgObjectId,
            month:  yearMonth,         // e.g. "2026-02"
          },
          // Nest under metrics so $merge doesn't clobber dailyLeaveHeatmap
          'metrics.totalHeadcount':  '$totalHeadcount',
          'metrics.totalSalaryBurn': '$totalSalaryBurn',
          lastCalculatedAt:          '$$NOW',
        },
      },

      // Step 4 — upsert into the materialized view collection
      {
        $merge: {
          into:           'analytics_monthly_trends',
          on:             '_id',
          whenMatched:    'merge',   // preserves dailyLeaveHeatmap written by Pipeline B
          whenNotMatched: 'insert',
        },
      },
    ]),

    // ── Pipeline B: Daily Leave Heatmap + leaveDaysTaken ──────────────────
    LeaveRequest.aggregate([
      // Step 1 — approved leaves that overlap with the target month
      {
        $match: {
          orgId:              orgObjectId,
          status:             'approved',
          'dates.startDate':  { $lt:  periodEnd   },
          'dates.endDate':    { $gte: periodStart },
        },
      },

      // Step 2 — generate every calendar day of the leave inside MongoDB.
      //          $range produces [0, 1, 2 … N-1] offsets in milliseconds
      //          which we convert to "YYYY-MM-DD" strings.
      //          This avoids ANY JavaScript looping — MongoDB does all the work.
      {
        $addFields: {
          // Array of Date objects: one per day from startDate to endDate (inclusive)
          leaveDates: {
            $map: {
              input: {
                $range: [
                  0,
                  {
                    // Number of days in this leave (capped to the target month)
                    $add: [
                      1,
                      {
                        $dateDiff: {
                          startDate: {
                            $max: ['$dates.startDate', periodStart],
                          },
                          endDate: {
                            $min: ['$dates.endDate', { $subtract: [periodEnd, 1] }],
                          },
                          unit: 'day',
                        },
                      },
                    ],
                  },
                  1, // step = 1 day
                ],
              },
              as: 'dayOffset',
              in: {
                // Add dayOffset * 86400000 ms to the clamped start to get each day
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: {
                    $dateAdd: {
                      startDate: { $max: ['$dates.startDate', periodStart] },
                      unit:      'day',
                      amount:    '$$dayOffset',
                    },
                  },
                },
              },
            },
          },
        },
      },

      // Step 3 — flatten the array so each leave-day is its own document
      { $unwind: '$leaveDates' },

      // Step 4 — filter to only days that actually fall inside the target month
      //          (edge case: multi-month leaves that span the month boundary)
      {
        $match: {
          $expr: {
            $and: [
              { $gte: ['$leaveDates', { $dateToString: { format: '%Y-%m-%d', date: periodStart } }] },
              { $lt:  ['$leaveDates', { $dateToString: { format: '%Y-%m-%d', date: periodEnd   } }] },
            ],
          },
        },
      },

      // Step 5 — count leaves per day
      {
        $group: {
          _id:            '$leaveDates',   // "YYYY-MM-DD"
          leaves:         { $sum: 1 },
        },
      },

      // Step 6 — sort chronologically (required before $group push)
      { $sort: { _id: 1 } },

      // Step 7 — collapse all days into a single document for $merge
      {
        $group: {
          _id: {
            orgId: orgObjectId,
            month: yearMonth,
          },
          dailyLeaveHeatmap: {
            $push: { date: '$_id', leaves: '$leaves' },
          },
          leaveDaysTaken: { $sum: '$leaves' },
        },
      },

      // Step 8 — reshape to match the Materialized View schema
      {
        $project: {
          _id:                         1,   // compound key already set in $group
          dailyLeaveHeatmap:           1,
          'metrics.leaveDaysTaken':    '$leaveDaysTaken',
          lastCalculatedAt:            '$$NOW',
        },
      },

      // Step 9 — upsert — merges with headcount/salary fields written by Pipeline A
      {
        $merge: {
          into:           'analytics_monthly_trends',
          on:             '_id',
          whenMatched:    'merge',
          whenNotMatched: 'insert',
        },
      },
    ]),

  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER 2 — updateRetentionCohorts(orgId)
//
// Buckets every employee by tenure (years since createdAt).
// All arithmetic happens in $addFields + $bucket — zero Node.js math.
// Result is merged into analytics_org_summaries as a single org document.
// ─────────────────────────────────────────────────────────────────────────────
export const updateRetentionCohorts = async (orgId) => {
  const orgObjectId = new mongoose.Types.ObjectId(orgId);

  await User.aggregate([
    // Step 1 — active employees only
    {
      $match: {
        orgId:     orgObjectId,
        isDeleted: false,
      },
    },

    // Step 2 — compute tenure in fractional years entirely inside MongoDB
    {
      $addFields: {
        tenureYears: {
          $dateDiff: {
            startDate: '$createdAt',
            endDate:   '$$NOW',
            unit:      'year',
          },
        },
      },
    },

    // Step 3 — bucket by tenure
    //   Boundaries:   [0, 1)  → underOneYear
    //                 [1, 3)  → oneToThreeYears
    //                 [3, 5)  → threeToFiveYears
    //                 [5, ∞)  → fivePlusYears  (default bucket)
    {
      $bucket: {
        groupBy:    '$tenureYears',
        boundaries: [0, 1, 3, 5],
        default:    'fivePlusYears',
        output: {
          count: { $sum: 1 },
        },
      },
    },

    // Step 4 — collapse all buckets into a single document.
    //          $push creates an array of { k: bucketId, v: count } pairs
    //          which $arrayToObject converts to a plain object.
    {
      $group: {
        _id: null,
        buckets: {
          $push: {
            k: {
              $switch: {
                branches: [
                  { case: { $eq: ['$_id', 0] }, then: 'underOneYear'     },
                  { case: { $eq: ['$_id', 1] }, then: 'oneToThreeYears'  },
                  { case: { $eq: ['$_id', 3] }, then: 'threeToFiveYears' },
                ],
                default: 'fivePlusYears',
              },
            },
            v: '$count',
          },
        },
      },
    },

    // Step 5 — reshape to the exact Materialized View schema.
    //          $arrayToObject turns [{ k, v }] → { underOneYear: N, … }
    {
      $project: {
        _id:               orgObjectId,   // _id IS the orgId for OrgSummary
        retentionCohorts: { $arrayToObject: '$buckets' },
        lastCalculatedAt: '$$NOW',
      },
    },

    // Step 6 — fill in any missing cohort keys with 0 so the document
    //          always has all four fields even if a bucket had no members
    {
      $addFields: {
        'retentionCohorts.underOneYear': {
          $ifNull: ['$retentionCohorts.underOneYear', 0],
        },
        'retentionCohorts.oneToThreeYears': {
          $ifNull: ['$retentionCohorts.oneToThreeYears', 0],
        },
        'retentionCohorts.threeToFiveYears': {
          $ifNull: ['$retentionCohorts.threeToFiveYears', 0],
        },
        'retentionCohorts.fivePlusYears': {
          $ifNull: ['$retentionCohorts.fivePlusYears', 0],
        },
      },
    },

    // Step 7 — upsert into org summaries materialized view
    {
      $merge: {
        into:           'analytics_org_summaries',
        on:             '_id',
        whenMatched:    'merge',   // preserves burnoutPredictor written by other workers
        whenNotMatched: 'insert',
      },
    },
  ]);
};