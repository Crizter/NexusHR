import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { OrganizationLeaveStats } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  Legend, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const PIE_COLORS: Record<string, string> = {
  casual_leave: '#facc15',   // yellow-400
  sick_leave:   '#f87171',   // red-400
};

const PIE_LABELS: Record<string, string> = {
  casual_leave: 'Casual Leave',
  sick_leave:   'Sick Leave',
};

const BAR_COLOR = '#6366f1';   // indigo-500

// ─── Custom Pie tooltip ───────────────────────────────────────────────────────
function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: d } = payload[0];
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-800">{PIE_LABELS[name] ?? name}</p>
      <p className="text-gray-500">{value} days · {d.count} request{d.count !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ─── Custom Bar tooltip ───────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="text-gray-500">{payload[0].value} days · {payload[0].payload.count} request{payload[0].payload.count !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function OrganizationLeaveSummary() {
  const [stats,   setStats]   = useState<OrganizationLeaveStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOrganizationLeaveStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return <SummarySkeleton />;

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
        <Button size="sm" variant="outline" className="ml-auto" onClick={fetchStats}>
          Retry
        </Button>
      </div>
    );
  }

  // ── No data ──────────────────────────────────────────────────────────────
  if (!stats || (stats.leavesByType.length === 0 && stats.leavesByDepartment.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-16 text-center">
        <p className="text-sm font-medium text-gray-700">No approved leaves found</p>
        <p className="mt-1 text-xs text-gray-400">Stats will appear once leaves are approved.</p>
      </div>
    );
  }

  // ── Prepare chart data ────────────────────────────────────────────────────
  const pieData = stats.leavesByType.map(d => ({
    name:     d.type,
    value:    d.totalDays,
    count:    d.count,
  }));

  const barData = stats.leavesByDepartment.map(d => ({
    name:     d.departmentName,
    totalDays: d.totalDays,
    count:    d.count,
  }));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

      {/* ── Donut chart — Leave by Type ─────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Leave by Type</h3>
          <p className="text-xs text-gray-400">Total approved days per leave category</p>
        </div>

        {pieData.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">No data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                strokeWidth={2}
                stroke="#fff"
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[entry.name] ?? '#94a3b8'}
                  />
                ))}
              </Pie>

              <ReTooltip content={<PieTooltip />} />

              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-gray-600">
                    {PIE_LABELS[value] ?? value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}

        {/* Stat pills */}
        <div className="flex flex-wrap gap-3">
          {stats.leavesByType.map(d => (
            <div
              key={d.type}
              className="flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: PIE_COLORS[d.type] ?? '#94a3b8' }}
              />
              <span className="text-xs font-medium text-gray-700">
                {PIE_LABELS[d.type]}:
              </span>
              <span className="text-xs text-gray-500">{d.totalDays}d</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bar chart — Leave by Department ────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Leave by Department</h3>
          <p className="text-xs text-gray-400">Total approved days per department</p>
        </div>

        {barData.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">No data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={barData}
              margin={{ top: 4, right: 16, left: 0, bottom: 40 }}
              barSize={32}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />

              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                angle={-35}
                textAnchor="end"
                interval={0}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />

              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}d`}
                width={36}
              />

              <ReTooltip
                content={<BarTooltip />}
                cursor={{ fill: '#f3f4f6' }}
              />

              <Bar
                dataKey="totalDays"
                fill={BAR_COLOR}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}