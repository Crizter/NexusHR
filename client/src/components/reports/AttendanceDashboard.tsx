import { useState, useEffect, useMemo }  from 'react';
import {
  LineChart, Line,
  BarChart,  Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Users, CalendarOff, AlertCircle, Loader2 } from 'lucide-react';
import { api, type OrgAttendanceStat } from '@/lib/api';

// ── Month name lookup — avoids re-creating on every render ───────────────────
const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_FULL = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Chart colours ─────────────────────────────────────────────────────────────
const COLOR_PRESENT = '#4f46e5';   // indigo-600
const COLOR_LEAVE   = '#f59e0b';   // amber-500
const COLOR_ABSENT  = '#ef4444';   // red-500
const COLOR_RATE    = '#10b981';   // emerald-500

// Custom tooltip for the LineChart
const RateTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p style={{ color: COLOR_RATE }}>
        Avg Rate:{' '}
        <span className="font-bold">{payload[0]?.value?.toFixed(1)}%</span>
      </p>
      <p style={{ color: COLOR_LEAVE }}>
        Avg On Leave:{' '}
        <span className="font-bold">{payload[1]?.value ?? 0}</span>
      </p>
    </div>
  );
};

// Custom tooltip for the BarChart
const DeptTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const present = payload.find((p: any) => p.dataKey === 'present')?.value ?? 0;
  const onLeave = payload.find((p: any) => p.dataKey === 'onLeave')?.value ?? 0;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p style={{ color: COLOR_PRESENT }}>
        Present: <span className="font-bold">{present}</span>
      </p>
      <p style={{ color: COLOR_LEAVE }}>
        On Leave: <span className="font-bold">{onLeave}</span>
      </p>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// Types for transformed (chart-ready) data
// ─────────────────────────────────────────────────────────────────────────────
interface MonthlyTrendPoint {
  month:          string;   // "Jan", "Feb" …
  monthNum:       number;
  avgRate:        number;   // average attendance rate for the month
  totalOnLeave:   number;   // sum of daily onLeave counts
  totalPresent:   number;
}

interface DeptBreakdownPoint {
  departmentName: string;
  present:        number;
  onLeave:        number;
}

interface AttendanceDashboardProps {
  selectedYear?:  number;
  onYearChange?:  (year: number) => void;
}

export function AttendanceDashboard({ selectedYear: propYear, onYearChange }: AttendanceDashboardProps) {
  const currentYear = new Date().getUTCFullYear();

  //  Use prop year if provided (controlled), otherwise own state (standalone use)
  const [internalYear, setInternalYear] = useState<number>(currentYear);
  const selectedYear  = propYear ?? internalYear;
  const setSelectedYear = (y: number) => {
    setInternalYear(y);
    onYearChange?.(y);
  };

  const [attendanceData,  setAttendanceData]  = useState<OrgAttendanceStat[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getOrgAttendance(selectedYear);
        //  Guard — API might return null/undefined on empty result
        setAttendanceData(Array.isArray(data) ? data : []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load attendance data';
        console.error('[AttendanceDashboard] Fetch error:', msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  // ── Data transformation 1: Group daily rows by month ──────────────────────
  // Returns one point per month — used by the LineChart
  const monthlyTrend = useMemo((): MonthlyTrendPoint[] => {
    if (!attendanceData.length) return [];

    // Accumulate sums per month number (1–12)
    const byMonth = new Map<number, {
      rateSum:    number;
      leaveSum:   number;
      presentSum: number;
      days:       number;
    }>();

    for (const stat of attendanceData) {
      const m = stat._id.month;
      const existing = byMonth.get(m) ?? { rateSum: 0, leaveSum: 0, presentSum: 0, days: 0 };
      byMonth.set(m, {
        rateSum:    existing.rateSum    + stat.metrics.attendanceRate,
        leaveSum:   existing.leaveSum   + stat.metrics.onLeave,
        presentSum: existing.presentSum + stat.metrics.present,
        days:       existing.days       + 1,
      });
    }

    // Convert map to sorted array
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a - b)
      .map(([monthNum, vals]) => ({
        month:        MONTH_NAMES[monthNum],
        monthNum,
        avgRate:      parseFloat((vals.rateSum    / vals.days).toFixed(1)),
        totalOnLeave: Math.round(vals.leaveSum   / vals.days),   // avg daily on-leave
        totalPresent: Math.round(vals.presentSum / vals.days),
      }));
  }, [attendanceData]);

  // ── Data transformation 2: Department breakdown for the latest month ───────
  // Finds the most recent month in the data and sums dept stats across its days
  const departmentStats = useMemo((): DeptBreakdownPoint[] => {
    if (!attendanceData.length) return [];

    // Latest month = last element's month (data is sorted asc by date)
    const latestMonth = attendanceData[attendanceData.length - 1]._id.month;

    // Filter to only the latest month's daily rows
    const latestRows = attendanceData.filter(s => s._id.month === latestMonth);

    // Accumulate per-department across all days of the latest month
    const byDept = new Map<string, { present: number; onLeave: number }>();

    for (const row of latestRows) {
      for (const dept of row.departmentBreakdown) {
        const key      = dept.departmentName;
        const existing = byDept.get(key) ?? { present: 0, onLeave: 0 };
        byDept.set(key, {
          present: existing.present + dept.present,
          onLeave: existing.onLeave + dept.onLeave,
        });
      }
    }

    return Array.from(byDept.entries()).map(([departmentName, vals]) => ({
      departmentName,
      present:  Math.round(vals.present / latestRows.length),   // avg daily
      onLeave:  Math.round(vals.onLeave / latestRows.length),
    }));
  }, [attendanceData]);

  // ── Insight: YTD average attendance rate ──────────────────────────────────
  const ytdAvgRate = useMemo(() => {
    if (!attendanceData.length) return 0;
    const sum = attendanceData.reduce((acc, s) => acc + s.metrics.attendanceRate, 0);
    return parseFloat((sum / attendanceData.length).toFixed(1));
  }, [attendanceData]);

  // ── Insight: Peak leave season (month with highest avg daily on-leave) ─────
  const peakLeaveMonth = useMemo(() => {
    if (!monthlyTrend.length) return 'N/A';
    const peak = monthlyTrend.reduce((max, m) =>
      m.totalOnLeave > max.totalOnLeave ? m : max
    );
    return MONTH_NAMES_FULL[peak.monthNum];
  }, [monthlyTrend]);

  // ── Latest month name for the bar chart title ──────────────────────────────
  const latestMonthName = useMemo(() => {
    if (!attendanceData.length) return '';
    return MONTH_NAMES_FULL[attendanceData[attendanceData.length - 1]._id.month];
  }, [attendanceData]);

  // ── Year selector options (current year and 2 previous years) ─────────────
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear];

  // ─────────────────────────────────────────────────────────────────────────
  // Render states
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
        <span className="text-gray-500 text-sm">Loading attendance data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        <div>
          <p className="text-red-700 font-medium text-sm">Failed to load attendance data</p>
          <p className="text-red-500 text-xs mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">

        {/* Year selector */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* ── No data state ─────────────────────────────────────────────────── */}
      {attendanceData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-white
                        rounded-xl border border-dashed border-gray-300">
          <CalendarOff className="h-8 w-8 text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm font-medium">No attendance data for {selectedYear}</p>
          {/*  Actionable message — tells HR exactly what to check */}
          <p className="text-gray-400 text-xs mt-1 text-center max-w-xs">
            Check the browser console for API response details.
            Verify the cron job wrote to <code className="bg-gray-100 px-1 rounded">report_attendance_stats</code> with
            <code className="bg-gray-100 px-1 rounded ml-1">_id.year = {selectedYear}</code>
          </p>
        </div>
      ) : (
        <>
          {/* ── Insight cards ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Card 1 — YTD Average Attendance */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5
                            flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-50">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  YTD Avg Attendance
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-0.5">
                  {ytdAvgRate}
                  <span className="text-base font-medium text-gray-400 ml-1">%</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Across {attendanceData.length} working days
                </p>
              </div>
            </div>

            {/* Card 2 — Peak Leave Season */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5
                            flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-amber-50">
                <CalendarOff className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Peak Leave Season
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-0.5">{peakLeaveMonth}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Highest average daily leaves
                </p>
              </div>
            </div>

            {/* Card 3  — Latest day snapshot */}
            {attendanceData.length > 0 && (() => {
              const latest = attendanceData[attendanceData.length - 1];
              return (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5
                                flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-indigo-50">
                    <Users className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Last Processed Day
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">
                      {latest._id.date}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {latest.metrics.present} present · {latest.metrics.onLeave} on leave
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Charts grid ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Chart 1 — Monthly Attendance Trend (Line) */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Monthly Attendance Trend
              </h3>
              <p className="text-xs text-gray-400 mb-5">
                Average daily attendance rate per month
              </p>

              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyTrend} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="rate"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="leave"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<RateTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                    formatter={(value) =>
                      value === 'avgRate' ? 'Avg Rate (%)' : 'Avg On Leave'
                    }
                  />
                  <Line
                    yAxisId="rate"
                    type="monotone"
                    dataKey="avgRate"
                    stroke={COLOR_RATE}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: COLOR_RATE }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="leave"
                    type="monotone"
                    dataKey="totalOnLeave"
                    stroke={COLOR_LEAVE}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={{ r: 3, fill: COLOR_LEAVE }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2 — Department Breakdown (Stacked Bar) */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Department Breakdown
              </h3>
              <p className="text-xs text-gray-400 mb-5">
                Avg daily presence vs on-leave · {latestMonthName} {selectedYear}
              </p>

              {departmentStats.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                  No department data for the latest month
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={departmentStats}
                    margin={{ top: 4, right: 16, left: -10, bottom: 0 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="departmentName"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<DeptTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                      formatter={(value) =>
                        value === 'present' ? 'Present' : 'On Leave'
                      }
                    />
                    {/* Stacked bars — present on bottom, onLeave on top */}
                    <Bar
                      dataKey="present"
                      stackId="a"
                      fill={COLOR_PRESENT}
                      radius={[0, 0, 4, 4]}
                    />
                    <Bar
                      dataKey="onLeave"
                      stackId="a"
                      fill={COLOR_LEAVE}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}