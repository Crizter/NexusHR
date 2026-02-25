import { useEffect, useState, useCallback } from 'react';
import { format, getMonth, getYear }        from 'date-fns';
import { api }                              from '@/lib/api';
import type { Payslip }                     from '@/lib/api';
import { toast }                            from 'sonner';
import { EditPayslipModal }                 from '@/components/payroll/EditPayslipModal';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
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
  CheckCircle, Lock, Plus,
  Search,
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
      return <Badge className="bg-gray-100    text-gray-600   border-gray-200   hover:bg-gray-100"   >Draft</Badge>;
    case 'processed':
      return <Badge className="bg-blue-100    text-blue-700   border-blue-200   hover:bg-blue-100"   >Processed</Badge>;
    case 'paid':
      return <Badge className="bg-green-100   text-green-700  border-green-200  hover:bg-green-100"  >Paid</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ─── Currency formatter ───────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
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

  const [selectedMonth,  setSelectedMonth]  = useState<number>(getMonth(now) + 1);
  const [selectedYear,   setSelectedYear]   = useState<number>(getYear(now));
  const [payslips,       setPayslips]       = useState<Payslip[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isGenerating,   setIsGenerating]   = useState(false);
  const [actioningId,    setActioningId]    = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isBulkLocking, setIsBulkLocking] = useState(false);
  const [isBulkPaying,  setIsBulkPaying]  = useState(false);
  const [searchTerm,    setSearchTerm]    = useState('');


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

  // ── Generate payroll ───────────────────────────────────────────────────────
  


  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const result = await api.generatePayroll(selectedMonth, selectedYear);
      toast.success('Payroll generated', {
        description: result.message,
      });
      await fetchPayslips();
    } catch (err) {
      toast.error('Failed to generate payroll', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Status update ──────────────────────────────────────────────────────────
  const handleStatusUpdate = async (
    payslip: Payslip,
    newStatus: 'processed' | 'paid',
  ) => {
    try {
      setActioningId(payslip._id);
      await api.updatePayslipStatus(payslip._id, newStatus);

      const emp = typeof payslip.employeeId === 'object' ? payslip.employeeId : null;
      const name = emp ? `${emp.profile.firstName} ${emp.profile.lastName}` : 'Employee';

      toast.success(
        newStatus === 'processed' ? 'Payslip locked' : 'Marked as paid',
        { description: `${name}'s payslip has been ${newStatus === 'processed' ? 'processed and locked' : 'marked as paid'}.` }
      );

      await fetchPayslips();
    } catch (err) {
      toast.error('Action failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setActioningId(null);
    }
  };

   // ── Filtered payslips for search ───────────────────────────────────────────
  const filteredPayslips = payslips.filter(p => {
    if (!searchTerm.trim()) return true;
    if (typeof p.employeeId === 'string') return false;
    const term  = searchTerm.toLowerCase();
    const first = p.employeeId.profile.firstName.toLowerCase();
    const last  = p.employeeId.profile.lastName.toLowerCase();
    const email = p.employeeId.email.toLowerCase();
    const id    = p.employeeId.displayId.toLowerCase();
    return (
      first.includes(term) ||
      last.includes(term)  ||
      `${first} ${last}`.includes(term) ||
      email.includes(term) ||
      id.includes(term)
    );
  });

  // ── Bulk handlers ──────────────────────────────────────────────────────────
  const handleBulkLock = async () => {
    try {
      setIsBulkLocking(true);
      const result = await api.bulkLockPayslips(selectedMonth, selectedYear);
      toast.success('Payslips locked', {
        description: `${result.modifiedCount} draft payslip(s) have been locked.`,
      });
      await fetchPayslips();
    } catch (err) {
      toast.error('Bulk lock failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsBulkLocking(false);
    }
  };

  const handleBulkPay = async () => {
    try {
      setIsBulkPaying(true);
      const result = await api.bulkPayPayslips(selectedMonth, selectedYear);
      toast.success('Payslips paid', {
        description: `${result.modifiedCount} payslip(s) have been marked as paid.`,
      });
      await fetchPayslips();
    } catch (err) {
      toast.error('Bulk pay failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsBulkPaying(false);
    }
  };

  // ── Derived counts for conditional bulk buttons ────────────────────────────
  const draftCount     = payslips.filter(p => p.status === 'draft').length;
  const processedCount = payslips.filter(p => p.status === 'processed').length;

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalNetPay    = payslips.reduce((sum, p) => sum + (p.netPay ?? 0), 0);
  const approvedCount  = payslips.filter(p => p.status === 'processed').length;
  const paidCount      = payslips.filter(p => p.status === 'paid').length;

  const periodLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and process payslips for your organisation.
          </p>
        </div>

        {/* Period selectors */}
        <div className="flex items-center gap-2">

           {/* Bulk Lock — only if drafts exist */}
          {draftCount > 0 && (
            <Button
              variant="outline"
              size="sm"
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
              variant="outline"
              size="sm"
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

          {payslips.length > 0 && (
            <Button onClick={handleGenerate} disabled={isGenerating} variant="outline" size="sm">
              {isGenerating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Plus className="mr-1.5 h-4 w-4" />Top-up</>}
            </Button>
          )}
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
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
            <Button className="mt-6" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                : <><Plus className="mr-2 h-4 w-4" />Generate Payroll</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
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

          {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Search by name, email or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {!isLoading && (
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
                  ) : (
                    filteredPayslips.map((payslip) => {
                      const emp  = typeof payslip.employeeId === 'object' ? payslip.employeeId : null;
                      const name = emp ? `${emp.profile.firstName} ${emp.profile.lastName}` : '—';
                      const id   = emp?.displayId ?? '';

                      const totalEarnings   = payslip.earnings.bonus + payslip.earnings.allowances;
                      const totalDeductions = payslip.deductions.tax + payslip.deductions.healthInsurance + payslip.deductions.unpaidLeave;
                      const isActioning     = actioningId === payslip._id;

                      return (
                        <TableRow key={payslip._id} className="hover:bg-gray-50 transition-colors">
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
                          <TableCell><StatusBadge status={payslip.status} /></TableCell>

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

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      <EditPayslipModal
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        payslip={selectedPayslip}
        onSuccess={fetchPayslips}
      />
    </div>
  );
}