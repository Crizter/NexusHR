import { useEffect, useMemo, useState }  from 'react';
import { api }                           from '@/lib/api';
import type { Payslip }                  from '@/lib/api';
import { format, getMonth, getYear }     from 'date-fns';
import { usePayslipDownload }            from '@/hooks/usePayslipDownload';
import { useAuth }                       from '@/context/AuthContext';
import { PERMISSIONS }                   from '@/lib/config';
import {
  Loader2, Download, FileText,
  Search, Users,
} from 'lucide-react';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input }   from '@/components/ui/input';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEARS = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

const monthName = (m: number) => MONTHS[m - 1];

function StatusBadge({ status }: { status: Payslip['status'] }) {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Draft</Badge>;
    case 'processed':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Processed</Badge>;
    case 'paid':
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Paid</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Shared Download Button ───────────────────────────────────────────────────
// Used in both MyPayslips and AllPayslips so it lives here as a named export
export function DownloadButton({
  payslipId,
  filename,
  isDownloading,
  isAnyDownloading,
  onDownload,
}: {
  payslipId:        string;
  filename:         string;
  isDownloading:    boolean;
  isAnyDownloading: boolean;
  onDownload:       (id: string, filename: string) => Promise<void>;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1.5"
      disabled={isDownloading || isAnyDownloading}
      onClick={() => onDownload(payslipId, filename)}
    >
      {isDownloading
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Download className="h-3 w-3" />}
      {isDownloading ? 'Generating...' : 'Download PDF'}
    </Button>
  );
}

// ─── AllPayslips — HR Manager / Super Admin view ──────────────────────────────
export function AllPayslips() {
  const now = new Date();

  const { hasPermission } = useAuth();
const canViewPayroll = hasPermission(PERMISSIONS.PAYROLL_RECORD);

  const [selectedMonth, setSelectedMonth] = useState(getMonth(now) + 1);
  const [selectedYear,  setSelectedYear]  = useState(getYear(now));
  const [searchTerm,    setSearchTerm]    = useState('');
  const [payslips,      setPayslips]      = useState<Payslip[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);

  const { handleDownload, isDownloading, downloadingId } = usePayslipDownload();

  const periodLabel = `${monthName(selectedMonth)} ${selectedYear}`;

  // ── Guard: redirect non-HR users at the component level ───────────────────
  if (!canViewPayroll) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await api.getPayslips(selectedMonth, selectedYear);
        if (!cancelled) setPayslips(data);
      } catch (err) {
        console.error('AllPayslips load error:', err);
        if (!cancelled) setPayslips([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedMonth, selectedYear]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return payslips;
    const q = searchTerm.toLowerCase();
    return payslips.filter(p => {
      const emp = typeof p.employeeId === 'object' ? p.employeeId : null;
      if (!emp) return false;
      const name = `${emp.profile.firstName} ${emp.profile.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        emp.displayId.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q)
      );
    });
  }, [payslips, searchTerm]);

  const paidCount  = useMemo(() => payslips.filter(p => p.status === 'paid').length, [payslips]);
  const totalCount = payslips.length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Payslips</h1>
            <p className="text-sm text-gray-500">
              Download PDFs for any employee — {periodLabel}.
            </p>
          </div>
        </div>

        {/* Period selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedMonth.toString()}
            onValueChange={v => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedYear.toString()}
            onValueChange={v => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats strip */}
      {!isLoading && totalCount > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            <FileText className="h-3 w-3" />
            {totalCount} payslip{totalCount !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
            {paidCount} paid
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
            {totalCount - paidCount} unpaid
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Search by name, email or ID..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900">
            Payslips — {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {searchTerm
                  ? `No payslips match "${searchTerm}"`
                  : `No payslips found for ${periodLabel}.`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold text-gray-700">Employee</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-right">Base Salary</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-right">Earnings</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-right">Deductions</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-right">Net Pay</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(payslip => {
                  const emp  = typeof payslip.employeeId === 'object' ? payslip.employeeId : null;
                  const name = emp
                    ? `${emp.profile.firstName} ${emp.profile.lastName}`
                    : '—';

                  const totalEarnings =
                    payslip.earnings.baseSalary +
                    payslip.earnings.bonus +
                    payslip.earnings.allowances;

                  const totalDeductions =
                    payslip.deductions.tax +
                    payslip.deductions.healthInsurance +
                    payslip.deductions.unpaidLeave;

                  const filename    = `Payslip_${name.replace(/\s+/g, '_')}_${monthName(payslip.payPeriod.month)}_${payslip.payPeriod.year}.pdf`;
                  const downloading = isDownloading(payslip._id);

                  // HR can only download PDFs for paid payslips
                  // (unpaid ones have no s3Key — would return 202)
                  const canDownload = payslip.status === 'paid';

                  return (
                    <TableRow key={payslip._id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>
                        <p className="text-sm font-medium text-gray-900">{name}</p>
                        {emp?.displayId && (
                          <p className="text-xs text-gray-400">{emp.displayId}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-600 tabular-nums">
                        ${payslip.earnings.baseSalary.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-700 font-medium tabular-nums">
                        +${totalEarnings.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600 tabular-nums">
                        −${totalDeductions.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-gray-900 tabular-nums">
                        ${payslip.netPay.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payslip.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        {canDownload ? (
                          <DownloadButton
                            payslipId={payslip._id}
                            filename={filename}
                            isDownloading={downloading}
                            isAnyDownloading={!!downloadingId}
                            onDownload={handleDownload}
                          />
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            Not available
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}