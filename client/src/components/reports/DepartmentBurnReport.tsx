import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend,
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF       from 'jspdf';
import { api }     from '@/lib/api';
import type { DepartmentBurnRecord } from '@/lib/api';
import { toast }   from 'sonner';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button }   from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Download, TrendingDown, DollarSign,
  Users, Loader2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

// Distinct colours per department — cycles if more than 10 depts
const DEPT_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6',
  '#f97316', '#84cc16',
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

// ─── Currency formatters ──────────────────────────────────────────────────────
/** Full: $1,234,567 */
const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);

/** Compact: $1.2M / $150k — used on the Y-axis */
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const BurnTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?:   string;
}) => {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xl text-sm min-w-[180px]">
      <p className="mb-2 font-bold text-gray-800">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: p.fill }}
            />
            <span className="text-gray-600 truncate max-w-[110px]">{p.name}</span>
          </div>
          <span className="font-semibold text-gray-900 tabular-nums">
            {fmtCompact(p.value)}
          </span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2">
          <span className="font-semibold text-gray-700">Total</span>
          <span className="font-bold text-gray-900 tabular-nums">{fmtCompact(total)}</span>
        </div>
      )}
    </div>
  );
};

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string;
  sub?:  string;
  icon:  React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
        <div className={`rounded-md p-1.5 ${color}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DepartmentBurnReport() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [rawData,      setRawData]      = useState<DepartmentBurnRecord[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isExporting,  setIsExporting]  = useState(false);

  // Ref wraps the printable area — captured by html2canvas
  const dashboardRef = useRef<HTMLDivElement>(null);

  // ── Fetch whenever year changes ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
// TODO: DEPARTMENTID IS NULL - 
// IN PAYSLIPS THERE IS NO PROPERTY FOR DEPARTMENT ID 
    const fetch = async () => {
      try {
        setIsLoading(true);
        const data = await api.getDepartmentBurn(selectedYear);
        console.log('data',data) ; 
        if (!cancelled) setRawData(data);
      } catch (err) {
        if (!cancelled) {
          toast.error('Failed to load department burn data', {
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [selectedYear]);

  // ── Transform rawData → recharts-friendly format ──────────────────────────
  // Output: [{ name: 'Jan', Engineering: 150000, Sales: 80000 }, ...]
  const { chartData, departmentNames } = useMemo(() => {
    if (rawData.length === 0) {
      return { chartData: [], departmentNames: [] };
    }

    // Collect unique dept names (populated object or fallback string)
    const deptSet = new Set<string>();
    console.log(rawData) ; 
    rawData.forEach(r => {
      const name = typeof r.departmentId === 'object'
        ? r.departmentId.name
        : r.departmentId;
      deptSet.add(name);
    });
    const departmentNames = Array.from(deptSet).sort();

    // Build 12-slot array — one per month
    const slots: Record<string, number | string>[] = MONTH_NAMES.map(m => ({
      name: m,
      // Pre-fill every dept to 0 so stacked bar has correct baseline
      ...Object.fromEntries(departmentNames.map(d => [d, 0])),
    }));

    // Fill in actual values
    rawData.forEach(r => {
      const deptName = typeof r.departmentId === 'object'
        ? r.departmentId.name
        : r.departmentId;
      const monthIndex = r.month - 1;   // 1-based → 0-based
      if (monthIndex >= 0 && monthIndex < 12) {
        const existing = (slots[monthIndex][deptName] as number) ?? 0;
        slots[monthIndex][deptName] = existing + r.totalNetPay;
      }
    });

    return { chartData: slots, departmentNames };
  }, [rawData]);

  // ── Year-level summary totals ──────────────────────────────────────────────
  const { totalGross, totalNet, totalTaxes, peakMonth, totalHeadcount } =
    useMemo(() => {
      if (rawData.length === 0)
        return { totalGross: 0, totalNet: 0, totalTaxes: 0, peakMonth: '—', totalHeadcount: 0 };

      const totalGross     = rawData.reduce((s, r) => s + r.totalGrossPay, 0);
      const totalNet       = rawData.reduce((s, r) => s + r.totalNetPay,   0);
      const totalTaxes     = rawData.reduce((s, r) => s + r.totalTaxes,    0);
      const totalHeadcount = rawData.reduce((s, r) => s + r.employeeCount, 0);

      // Find the month with highest total net pay
      const byMonth = Array(12).fill(0);
      rawData.forEach(r => { byMonth[r.month - 1] += r.totalNetPay; });
      const peakIdx  = byMonth.indexOf(Math.max(...byMonth));
      const peakMonth = byMonth[peakIdx] > 0 ? MONTH_NAMES[peakIdx] : '—';

      return { totalGross, totalNet, totalTaxes, peakMonth, totalHeadcount };
    }, [rawData]);

  // ── PDF export ────────────────────────────────────────────────────────────
  const downloadPDF = async () => {
    if (!dashboardRef.current) return;

    try {
      setIsExporting(true);

      // Capture the dashboard div as a high-res canvas
      const canvas = await html2canvas(dashboardRef.current, {
        scale:            2,       // 2× for crisp text on retina
        useCORS:          true,
        backgroundColor:  '#ffffff',
        logging:          false,
      });

      const imgData = canvas.toDataURL('image/png');

      // A4 landscape — fits a wide bar chart nicely
      const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();

      // Scale image to fit the page width with a 10mm margin
      const margin  = 10;
      const imgW    = pageW - margin * 2;
      const imgH    = (canvas.height / canvas.width) * imgW;

      // If the chart is taller than one page, scale down further
      const finalH  = Math.min(imgH, pageH - margin * 2);
      const finalW  = (canvas.width / canvas.height) * finalH;

      pdf.addImage(
        imgData, 'PNG',
        (pageW - finalW) / 2,   // horizontally centred
        margin,
        finalW,
        finalH
      );

      pdf.save(`Department_Burn_Report_${selectedYear}.pdf`);
      toast.success('PDF exported successfully');

    } catch (err) {
      toast.error('PDF export failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Department Payroll Burn</h2>
          <p className="text-sm text-gray-500">
            Monthly net pay breakdown by department for {selectedYear}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Year selector */}
          <Select
            value={selectedYear.toString()}
            onValueChange={v => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* PDF download */}
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPDF}
            disabled={isLoading || isExporting || rawData.length === 0}
          >
            {isExporting
              ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              : <Download className="mr-1.5 h-4 w-4" />}
            {isExporting ? 'Exporting…' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* ── Printable area (captured by html2canvas) ──────────────────────── */}
      <div ref={dashboardRef} className="space-y-6 bg-white">

        {/* ── Summary cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard
            label="Total Gross Burn"
            value={isLoading ? '—' : fmtFull(totalGross)}
            sub="Before deductions"
            icon={<DollarSign className="h-4 w-4 text-indigo-600" />}
            color="bg-indigo-50"
          />
          <SummaryCard
            label="Total Net Burn"
            value={isLoading ? '—' : fmtFull(totalNet)}
            sub="After all deductions"
            icon={<TrendingDown className="h-4 w-4 text-emerald-600" />}
            color="bg-emerald-50"
          />
          <SummaryCard
            label="Total Taxes"
            value={isLoading ? '—' : fmtFull(totalTaxes)}
            sub="Tax withheld YTD"
            icon={<DollarSign className="h-4 w-4 text-amber-600" />}
            color="bg-amber-50"
          />
          <SummaryCard
            label="Peak Month"
            value={isLoading ? '—' : peakMonth}
            sub={`${totalHeadcount} payslips total`}
            icon={<Users className="h-4 w-4 text-blue-600" />}
            color="bg-blue-50"
          />
        </div>

        {/* ── Chart ───────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Monthly Net Pay by Department — {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              // Skeleton placeholder while fetching
              <div className="space-y-3">
                <Skeleton className="h-[320px] w-full rounded-lg" />
              </div>
            ) : rawData.length === 0 ? (
              // Empty state
              <div className="flex h-[320px] flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <TrendingDown className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">
                  No payroll data for {selectedYear}
                </p>
                <p className="max-w-xs text-xs text-gray-400">
                  Generate payroll for this year to see the department burn breakdown.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />

                  {/* Y-axis — compact currency labels ($150k, $1.2M) */}
                  <YAxis
                    tickFormatter={fmtCompact}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />

                  <Tooltip content={<BurnTooltip />} cursor={{ fill: '#f9fafb' }} />

                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                    iconType="square"
                    iconSize={10}
                  />

                  {/* Dynamically render one <Bar> per department */}
                  {departmentNames.map((dept, idx) => (
                    <Bar
                      key={dept}
                      dataKey={dept}
                      name={dept}
                      stackId="a"                               // ← stacked!
                      fill={DEPT_COLORS[idx % DEPT_COLORS.length]}
                      radius={
                        // Only round the top of the last (topmost) bar
                        idx === departmentNames.length - 1
                          ? [4, 4, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Per-department table ─────────────────────────────────────────── */}
        {!isLoading && rawData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">
                Yearly Totals by Department
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-600">Department</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Employees</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Gross Pay</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Net Pay</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Taxes</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentNames.map((dept, idx) => {
                      // Aggregate this dept's totals across all months
                      const deptRows = rawData.filter(r =>
                        (typeof r.departmentId === 'object'
                          ? r.departmentId.name
                          : r.departmentId) === dept
                      );
                      const gross    = deptRows.reduce((s, r) => s + r.totalGrossPay,  0);
                      const net      = deptRows.reduce((s, r) => s + r.totalNetPay,    0);
                      const taxes    = deptRows.reduce((s, r) => s + r.totalTaxes,     0);
                      const headcount = Math.max(...deptRows.map(r => r.employeeCount));
                      const pct      = totalNet > 0
                        ? ((net / totalNet) * 100).toFixed(1)
                        : '0.0';

                      return (
                        <tr
                          key={dept}
                          className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                                style={{ background: DEPT_COLORS[idx % DEPT_COLORS.length] }}
                              />
                              <span className="font-medium text-gray-900">{dept}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                            {headcount}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                            {fmtFull(gross)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                            {fmtFull(net)}
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 tabular-nums">
                            {fmtFull(taxes)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totals footer */}
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                      <td className="px-4 py-3 text-gray-900">Total</td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {totalHeadcount}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {fmtFull(totalGross)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {fmtFull(totalNet)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-700 tabular-nums">
                        {fmtFull(totalTaxes)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}