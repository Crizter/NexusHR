import { useEffect, useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  startOfYear,
  endOfYear,
  isWeekend,
  isWithinInterval,
  format,
  getMonth,
  getDay,
  startOfWeek,
  getYear,
} from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { api }     from '@/lib/api';
import type { AttendanceLeave } from '@/lib/api';
import { Loader2, XCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type DayStatus = 'present' | 'weekend' | 'casual_leave' | 'sick_leave' | 'future';

interface DayData {
  date:   Date;
  status: DayStatus;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_STYLES: Record<DayStatus, string> = {
  present:      'bg-green-500  hover:bg-green-600',
  weekend:      'bg-gray-200   hover:bg-gray-300',
  casual_leave: 'bg-yellow-400 hover:bg-yellow-500',
  sick_leave:   'bg-red-400    hover:bg-red-500',
  future:       'bg-gray-100   hover:bg-gray-200',
};

const STATUS_LABELS: Record<DayStatus, string> = {
  present:      'Present',
  weekend:      'Weekend',
  casual_leave: 'Casual Leave',
  sick_leave:   'Sick Leave',
  future:       'Upcoming',
};

// ─── Legend item ──────────────────────────────────────────────────────────────
function LegendItem({ status, label }: { status: DayStatus; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-3 w-3 rounded-sm ${STATUS_STYLES[status].split(' ')[0]}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface AttendanceHeatmapProps {
  year?: number;
}

export function AttendanceHeatmap({ year = getYear(new Date()) }: AttendanceHeatmapProps) {
  const [leaves,  setLeaves]  = useState<AttendanceLeave[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Fetch approved leaves ────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getAttendanceReport(year);
        setLeaves(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load attendance');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year]);

  // ── Build day grid ────────────────────────────────────────────────────────
  const { days, weekColumns, monthPositions } = useMemo(() => {
    const today    = new Date();
    const yearDate = new Date(year, 0, 1);
    const allDays  = eachDayOfInterval({
      start: startOfYear(yearDate),
      end:   endOfYear(yearDate),
    });

     // Strip time completely — convert ISO string to YYYY-MM-DD integer for comparison
    //    "2026-02-19T18:30:00.000Z" → date parts are UTC: year=2026, month=1, day=19
    //    So we use UTC getters to avoid timezone shift turning Feb 19 into Feb 20
    const toDateInt = (iso: string): number => {
      const d = new Date(iso);
      // Use UTC date parts — the backend stores midnight IST as 18:30 UTC previous day
      // So   read the UTC date
      return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    };

    // Pre-compute intervals as integer ranges for O(1) comparison
    const leaveRanges = leaves.map(l => ({
      type:     l.type,
      startInt: toDateInt(l.start),
      endInt:   toDateInt(l.end),
    }));

    const days: DayData[] = allDays.map(day => {
      if (day > today) return { date: day, status: 'future' };
      if (isWeekend(day)) return { date: day, status: 'weekend' };

      // Convert calendar day to same integer format
      const dayInt =
        day.getFullYear() * 10000 +
        (day.getMonth() + 1) * 100 +
        day.getDate();

      //  Simple integer range check — no timezone issues possible
      const hit = leaveRanges.find(
        ({ startInt, endInt }) => dayInt >= startInt && dayInt <= endInt
      );
      return {
        date:   day,
        status: hit
          ? (hit.type === 'sick_leave' ? 'sick_leave' : 'casual_leave') as DayStatus
          : 'present',
      };
    });

    // Group days into week columns (Sun-Sat grid, 7 rows)
    // Pad the first week so Jan 1 starts on the correct row
    const firstDayOfWeek = getDay(startOfYear(yearDate)); // 0=Sun … 6=Sat
    const paddedDays: (DayData | null)[] = [
      ...Array(firstDayOfWeek).fill(null),
      ...days,
    ];

    const weekColumns: (DayData | null)[][] = [];
    for (let i = 0; i < paddedDays.length; i += 7) {
      weekColumns.push(paddedDays.slice(i, i + 7));
    }

    // Month label positions (which column index each month starts)
    const monthPositions: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weekColumns.forEach((week, colIdx) => {
      const firstReal = week.find(d => d !== null) as DayData | undefined;
      if (!firstReal) return;
      const m = getMonth(firstReal.date);
      if (m !== lastMonth) {
        monthPositions.push({ label: MONTH_LABELS[m], col: colIdx });
        lastMonth = m;
      }
    });

    return { days, weekColumns, monthPositions };
  }, [leaves, year]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const present      = days.filter(d => d.status === 'present').length;
    const casualLeaves = days.filter(d => d.status === 'casual_leave').length;
    const sickLeaves   = days.filter(d => d.status === 'sick_leave').length;
    return { present, casualLeaves, sickLeaves };
  }, [days]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading attendance...</span>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">

        {/* Stats row */}
        <div className="flex flex-wrap gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            <p className="text-xs text-gray-500">Days Present</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-500">{stats.casualLeaves}</p>
            <p className="text-xs text-gray-500">Casual Leaves</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">{stats.sickLeaves}</p>
            <p className="text-xs text-gray-500">Sick Leaves</p>
          </div>
        </div>

        {/* Heatmap */}
        <div className="overflow-x-auto pb-2">
          <div className="inline-block min-w-max">

            {/* Month labels */}
            <div className="relative mb-1 flex" style={{ paddingLeft: '2rem' }}>
              {monthPositions.map(({ label, col }) => (
                <div
                  key={label}
                  className="absolute text-xs text-gray-400"
                  style={{ left: `calc(2rem + ${col} * 16px)` }}
                >
                  {label}
                </div>
              ))}
              {/* spacer so month row has height */}
              <div className="h-4" />
            </div>

            {/* Day labels + grid */}
            <div className="flex gap-1">

              {/* Day-of-week labels (Sun–Sat) */}
              <div className="flex flex-col gap-1 pr-1">
                {DAY_LABELS.map((d, i) => (
                  <div key={d} className="flex h-3 w-6 items-center">
                    {/* only show Mon / Wed / Fri to avoid clutter */}
                    {(i === 1 || i === 3 || i === 5) && (
                      <span className="text-[9px] text-gray-400">{d}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              <div className="flex gap-1">
                {weekColumns.map((week, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-1">
                    {week.map((day, rowIdx) => {
                      if (!day) {
                        // empty padding cell
                        return <div key={rowIdx} className="h-3 w-3" />;
                      }

                      return (
                        <Tooltip key={rowIdx}>
                          <TooltipTrigger asChild>
                            <div
                              className={`h-3 w-3 cursor-default rounded-sm transition-colors ${STATUS_STYLES[day.status]}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-gray-900 text-white text-xs px-2 py-1.5">
                            <p className="font-medium">{format(day.date, 'MMM d, yyyy')}</p>
                            <p className="text-gray-300">{STATUS_LABELS[day.status]}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <span className="text-xs font-medium text-gray-500">Legend:</span>
          <LegendItem status="present"      label="Present"      />
          <LegendItem status="casual_leave" label="Casual Leave" />
          <LegendItem status="sick_leave"   label="Sick Leave"   />
          <LegendItem status="weekend"      label="Weekend"      />
          <LegendItem status="future"       label="Upcoming"     />
        </div>
      </div>
    </TooltipProvider>
  );
}