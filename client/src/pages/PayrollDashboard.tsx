import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, getMonth, getYear }                 from 'date-fns';
import { api }                                       from '@/lib/api';
import type { Payslip }                              from '@/lib/api';
import { toast }                                     from 'sonner';
import { EditPayslipModal }                          from '@/components/payroll/EditPayslipModal';
import { PayrollGenerator }                          from '@/components/payroll/PayrollGenerator';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, Loader2, FileText,
  CheckCircle, Lock, Plus, Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEARS = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Payslip['status'] }) {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-100  text-gray-600  border-gray-200  hover:bg-gray-100" >Draft</Badge>;
    case 'processed':
      return <Badge className="bg-blue-100  text-blue-700  border-blue-200  hover:bg-blue-100" >Processed</Badge>;
    case 'paid':
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Paid</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Currency formatter ───────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
        <div className={`rounded-md p-1.5 ${color}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PayrollDashboard() {
  const now = new Date();

  const [selectedMonth,   setSelectedMonth]   = useState<number>(getMonth(now) + 1);
  const [selectedYear,    setSelectedYear]     = useState<number>(getYear(now));
  const [payslips,        setPayslips]         = useState<Payslip[]>([]);
  const [isLoading,       setIsLoading]        = useState(true);
  const [actioningId,     setActioningId]      = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip]  = useState<Payslip | null>(null);
  const [isBulkLocking,   setIsBulkLocking]    = useState(false);
  const [isBulkPaying,    setIsBulkPaying]     = useState(false);
  const [searchTerm,      setSearchTerm]       = useState('');

  // ── Derived label ──────────────────────────────────────────────────────────
  // e.g. "March 2026"
  const periodLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchPayslips = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getPayslips(selectedMonth, selectedYear);
      setPayslips(data);
    } catch (err) {
      toast.error('Failed to load payslips', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchPayslips(); }, [fetchPayslips]);

  // ── Derived counts & totals ────────────────────────────────────────────────
  const draftCount     = useMemo(() => payslips.filter(p => p.status === 'draft'     ).length, [payslips]);
  const processedCount = useMemo(() => payslips.filter(p => p.status === 'processed' ).length, [payslips]);
  const approvedCount  = processedCount;   // alias used in summary card
  const paidCount      = useMemo(() => payslips.filter(p => p.status === 'paid'      ).length, [payslips]);
  const totalNetPay    = useMemo(() => payslips.reduce((sum, p) => sum + (p.netPay ?? 0), 0),  [payslips]);

  // ── Filtered payslips (search) ─────────────────────────────────────────────
  const filteredPayslips = useMemo(() => {
    if (!searchTerm.trim()) return payslips;
    const q = searchTerm.toLowerCase();
    return payslips.filter(p => {
      const emp = typeof p.employeeId === 'object' ? p.employeeId : null;
      if (!emp) return false;
      const name      = `${emp.profile.firstName} ${emp.profile.lastName}`.toLowerCase();
      const displayId = (emp.displayId ?? '').toLowerCase();
      const email     = (emp.email    ?? '').toLowerCase();
      return name.includes(q) || displayId.includes(q) || email.includes(q);
    });
  }, [payslips, searchTerm]);

  // ── Single payslip status update ───────────────────────────────────────────
  const handleStatusUpdate = async (payslip: Payslip, newStatus: 'processed' | 'paid') => {
    try {
      setActioningId(payslip._id);
      await api.updatePayslipStatus(payslip._id, newStatus);
      toast.success(`Payslip marked as ${newStatus}`);
      await fetchPayslips();
    } catch (err) {
      toast.error('Failed to update status', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActioningId(null);
    }
  };

  // ── Bulk lock (draft → processed) ─────────────────────────────────────────
  const handleBulkLock = async () => {
    try {
      setIsBulkLocking(true);
      const drafts = payslips.filter(p => p.status === 'draft');
      await Promise.all(drafts.map(p => api.updatePayslipStatus(p._id, 'processed')));
      toast.success(`${drafts.length} payslips locked`);
      await fetchPayslips();
    } catch (err) {
      toast.error('Bulk lock failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsBulkLocking(false);
    }
  };

  // ── Bulk pay (processed → paid) ────────────────────────────────────────────
  const handleBulkPay = async () => {
    try {
      setIsBulkPaying(true);
      const processed = payslips.filter(p => p.status === 'processed');
      await Promise.all(processed.map(p => api.updatePayslipStatus(p._id, 'paid')));
      toast.success(`${processed.length} payslips marked as paid`);
      await fetchPayslips();
    } catch (err) {
      toast.error('Bulk pay failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsBulkPaying(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and process payslips for your organisation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {/* Bulk Lock — only if drafts exist */}
          {draftCount > 0 && (
            <Button
              variant="outline" size="sm"
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
              disabled={isBulkLocking || isBulkPaying}
              onClick={handleBulkLock}
            >
              {isBulkLocking
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Lock className="mr-1.5 h-3.5 w-3.5" />}
              Lock All Drafts ({draftCount})
            </Button>
          )}

          {/* Bulk Pay — only if processed exist */}
          {processedCount > 0 && (
            <Button
              variant="outline" size="sm"
              className="border-green-200 text-green-700 hover:bg-green-50"
              disabled={isBulkPaying || isBulkLocking}
              onClick={handleBulkPay}
            >
              {isBulkPaying
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
              Pay All Processed ({processedCount})
            </Button>
          )}

          {/* Month selector */}
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
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

          {/* Year selector */}
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Generate payroll — opens progress modal */}
          <PayrollGenerator
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            onComplete={fetchPayslips}
          />
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      {(isLoading || payslips.length > 0) && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard
            label="Total Payroll"
            value={isLoading ? '—' : fmt(totalNetPay)}
            icon={<DollarSign className="h-4 w-4 text-indigo-600" />}
            color="bg-indigo-50"
          />
          <SummaryCard
            label="Draft"
            value={isLoading ? '—' : draftCount.toString()}
            icon={<FileText className="h-4 w-4 text-gray-500" />}
            color="bg-gray-100"
          />
          <SummaryCard
            label="Processed"
            value={isLoading ? '—' : approvedCount.toString()}
            icon={<Lock className="h-4 w-4 text-blue-600" />}
            color="bg-blue-50"
          />
          <SummaryCard
            label="Paid"
            value={isLoading ? '—' : paidCount.toString()}
            icon={<CheckCircle className="h-4 w-4 text-green-600" />}
            color="bg-green-50"
          />
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!isLoading && payslips.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              No payroll for {periodLabel}
            </h3>
            <p className="mt-1.5 max-w-xs text-sm text-gray-500">
              Generate payslips for all active employees for this period.
            </p>
            {/* Reuses PayrollGenerator so the same modal + polling works */}
            <div className="mt-6">
              <PayrollGenerator
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
                onComplete={fetchPayslips}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Search ────────────────────────────────────────────────────────── */}
      {!isLoading && payslips.length > 0 && (
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2
                             text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search by name, email or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {(isLoading || payslips.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900">
              Payslips — {periodLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-700">Employee</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Base Salary</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Earnings</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Deductions</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Net Pay</TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading ? (
                    <TableSkeleton />
                  ) : filteredPayslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-400">
                        No payslips match "{searchTerm}"
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayslips.map((payslip) => {
                      const emp  = typeof payslip.employeeId === 'object' ? payslip.employeeId : null;
                      const name = emp
                        ? `${emp.profile.firstName} ${emp.profile.lastName}`
                        : '—';
                      const id          = emp?.displayId ?? '';
                      const totalEarnings   = payslip.earnings.bonus + payslip.earnings.allowances;
                      const totalDeductions = payslip.deductions.tax + payslip.deductions.healthInsurance + payslip.deductions.unpaidLeave;
                      const isActioning     = actioningId === payslip._id;

                      return (
                        <TableRow
                          key={payslip._id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Employee */}
                          <TableCell>
                            <p className="text-sm font-medium text-gray-900">{name}</p>
                            {id && <p className="text-xs text-gray-400">{id}</p>}
                          </TableCell>

                          {/* Base salary */}
                          <TableCell className="text-right text-sm text-gray-600">
                            {fmt(payslip.earnings.baseSalary)}
                          </TableCell>

                          {/* Bonus + allowances */}
                          <TableCell className="text-right text-sm text-green-700">
                            {totalEarnings > 0 ? `+${fmt(totalEarnings)}` : '—'}
                          </TableCell>

                          {/* Deductions */}
                          <TableCell className="text-right text-sm text-red-600">
                            {totalDeductions > 0 ? `−${fmt(totalDeductions)}` : '—'}
                          </TableCell>

                          {/* Net pay */}
                          <TableCell className="text-right text-sm font-semibold text-gray-900">
                            {fmt(payslip.netPay ?? 0)}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <StatusBadge status={payslip.status} />
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {payslip.status === 'draft' && (
                                <>
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs"
                                    disabled={isActioning}
                                    onClick={() => setSelectedPayslip(payslip)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm" variant="outline"
                                    className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                    disabled={isActioning}
                                    onClick={() => handleStatusUpdate(payslip, 'processed')}
                                  >
                                    {isActioning
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <><Lock className="mr-1 h-3 w-3" />Lock</>}
                                  </Button>
                                </>
                              )}

                              {payslip.status === 'processed' && (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                                  disabled={isActioning}
                                  onClick={() => handleStatusUpdate(payslip, 'paid')}
                                >
                                  {isActioning
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <><CheckCircle className="mr-1 h-3 w-3" />Mark Paid</>}
                                </Button>
                              )}

                              {payslip.status === 'paid' && (
                                <span className="text-xs text-gray-400 italic">
                                  {payslip.paymentDate
                                    ? `Paid ${format(new Date(payslip.paymentDate), 'MMM d')}`
                                    : 'Paid'}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      <EditPayslipModal
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        payslip={selectedPayslip}
        onSuccess={fetchPayslips}
      />
    </div>
  );
}