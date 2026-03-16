import { useEffect, useMemo, useState }  from 'react';
import { api }                           from '@/lib/api';
import type { Payslip, Department }      from '@/lib/api';
import { getMonth, getYear }             from 'date-fns';
import { usePayslipDownload }            from '@/hooks/usePayslipDownload';
import { useAuth }                       from '@/context/AuthContext';
import { PERMISSIONS }                   from '@/lib/config';
import {
  Loader2, Download, FileText,
  Search, Users, Building2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input }    from '@/components/ui/input';
import { Badge }    from '@/components/ui/badge';
import { Button }   from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEARS      = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
const monthName  = (m: number) => MONTHS[m - 1];
const PAGE_SIZE  = 20;

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

// ─── Shared Download Button (named export — used by MyProfile PayslipsTab) ────
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

// ─── AllPayslips — HR Manager / Super Admin ───────────────────────────────────
export function AllPayslips() {
  const now = new Date();

  const { hasPermission } = useAuth();
  const canViewPayroll    = hasPermission(PERMISSIONS.PAYROLL_RECORD);

  // ── Selector state ────────────────────────────────────────────────────────
  const [departments,    setDepartments]   = useState<Department[]>([]);
  const [depsLoading,    setDepsLoading]   = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedMonth,  setSelectedMonth] = useState(getMonth(now) + 1);
  const [selectedYear,   setSelectedYear]  = useState(getYear(now));

  // ── Data state ────────────────────────────────────────────────────────────
  const [payslips,  setPayslips]  = useState<Payslip[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Search + pagination ───────────────────────────────────────────────────
  const [searchTerm,  setSearchTerm]  = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { handleDownload, isDownloading, downloadingId } = usePayslipDownload();

  // ── Load departments once ─────────────────────────────────────────────────
  useEffect(() => {
    api.getDepartments()
      .then(data => setDepartments(data ?? []))
      .catch(() => setDepartments([]))
      .finally(() => setDepsLoading(false));
  }, []);

  // ── Fetch when all 3 selectors are set ───────────────────────────────────
  useEffect(() => {
    if (!selectedDeptId) return;

    let cancelled = false;
    // Reset search + page for the new bounded dataset
    setPayslips([]);
    setSearchTerm('');
    setCurrentPage(1);

    const load = async () => {
      try {
        setIsLoading(true);
        const data = await api.getPayslips(selectedMonth, selectedYear, selectedDeptId);
        if (!cancelled) setPayslips(data ?? []);
      } catch (err) {
        console.error('AllPayslips load error:', err);
        if (!cancelled) setPayslips([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedDeptId, selectedMonth, selectedYear]);

  // ── Reset to page 1 when search changes ──────────────────────────────────
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  // ── Client-side search ────────────────────────────────────────────────────
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

  // ── Client-side pagination ────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart  = (currentPage - 1) * PAGE_SIZE;
  const paginated  = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedDept = departments.find(d => d._id === selectedDeptId);
  const periodLabel  = `${monthName(selectedMonth)} ${selectedYear}`;
  const paidCount    = useMemo(() => payslips.filter(p => p.status === 'paid').length, [payslips]);

  // ── Permission guard (must be after all hooks) ────────────────────────────
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

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
          <Users className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Payslips</h1>
          <p className="text-sm text-gray-500">
            {selectedDeptId
              ? `${selectedDept?.name ?? 'Department'} — ${periodLabel}`
              : 'Select a department, month, and year to load payslips.'}
          </p>
        </div>
      </div>

      {/* ── Selectors + Search row ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Department — the bounding selector */}
        <Select
          value={selectedDeptId}
          onValueChange={v => setSelectedDeptId(v)}
          disabled={depsLoading}
        >
          <SelectTrigger className="w-[200px]">
            <Building2 className="h-4 w-4 mr-2 text-gray-400 shrink-0" />
            <SelectValue placeholder={depsLoading ? 'Loading…' : 'Select department'} />
          </SelectTrigger>
          <SelectContent>
            {departments.map(d => (
              <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Month */}
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

        {/* Year */}
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

        {/* Search — disabled until data is bounded and loaded */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search by name, email or ID…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            disabled={!selectedDeptId || isLoading}
            className="pl-9"
          />
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      {!isLoading && payslips.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            <FileText className="h-3 w-3" />
            {payslips.length} payslip{payslips.length !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
            {paidCount} paid
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
            {payslips.length - paidCount} unpaid
          </span>
          {searchTerm.trim() && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-600">
              {filtered.length} match{filtered.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900">
            {selectedDeptId
              ? `${selectedDept?.name ?? ''} — ${periodLabel}`
              : 'No department selected'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">

          {!selectedDeptId ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                Select a department, month, and year above to load payslips.
              </p>
            </div>

          ) : isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>

          ) : paginated.length === 0 ? (
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
                {paginated.map(payslip => {
                  const emp  = typeof payslip.employeeId === 'object' ? payslip.employeeId : null;
                  const name = emp ? `${emp.profile.firstName} ${emp.profile.lastName}` : '—';

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
                          <span className="text-xs text-gray-400 italic">Not available</span>
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

      {/* ── Pagination controls ──────────────────────────────────────────── */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-gray-500">
            Page {currentPage} of {totalPages} · {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}