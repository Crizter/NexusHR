import {
  useEffect, useState, useCallback,
  useMemo, useRef,
} from 'react';
import { format, getMonth, getYear } from 'date-fns';
import { api }                       from '@/lib/api';
import type { Payslip, User, Department } from '@/lib/api';
import { toast }                     from 'sonner';
import { EditPayslipModal }          from '@/components/payroll/EditPayslipModal';
import { PayrollGenerator }          from '@/components/payroll/PayrollGenerator';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DollarSign, Loader2, FileText, CheckCircle,
  Lock, Search, Gift, Calendar, Users,
  ChevronRight, Info, Settings2, Percent,
  ShieldCheck, UserX, Building2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const YEARS = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);

// ─── StatusBadge ──────────────────────────────────────────────────────────────
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

// ─── Skeletons ────────────────────────────────────────────────────────────────
function TableSkeleton({ cols = 7 }: { cols?: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full max-w-[120px]" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────
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

// ─── Edit Department Policies Modal ──────────────────────────────────────────
// Isolated so it tracks its own draft state without affecting the dashboard
function EditPoliciesModal({
  dept,
  isOpen,
  onClose,
  onSaved,
}: {
  dept:    Department;
  isOpen:  boolean;
  onClose: () => void;
  onSaved: (updated: Department) => void;
}) {
  const [tax,     setTax]     = useState(String(dept.payrollSettings.defaultTaxPercentage));
  const [health,  setHealth]  = useState(String(dept.payrollSettings.healthInsuranceFlatRate));
  const [leave,   setLeave]   = useState(String(dept.payrollSettings.unpaidLeaveDeductionPerDay));
  const [saving,  setSaving]  = useState(false);

  // Reset local state whenever the modal opens for a (possibly different) dept
  useEffect(() => {
    if (isOpen) {
      setTax   (String(dept.payrollSettings.defaultTaxPercentage));
      setHealth(String(dept.payrollSettings.healthInsuranceFlatRate));
      setLeave (String(dept.payrollSettings.unpaidLeaveDeductionPerDay));
    }
  }, [isOpen, dept]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await api.updateDepartmentPayrollSettings(dept._id, {
        defaultTaxPercentage:       parseFloat(tax)    || 0,
        healthInsuranceFlatRate:    parseFloat(health) || 0,
        unpaidLeaveDeductionPerDay: parseFloat(leave)  || 0,
      });
      toast.success(`${dept.name} policies updated.`);
      onSaved(updated);
      onClose();
    } catch (err) {
      toast.error('Failed to update policies', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-indigo-500" />
            Edit Payroll Policies — {dept.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Default Tax % */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-gray-400" />
              Default Tax Rate (%)
            </Label>
            <Input
              type="number" min={0} max={100}
              value={tax}
              onChange={e => setTax(e.target.value)}
              placeholder="e.g. 10"
            />
            <p className="text-xs text-gray-400">
              Applied to employees without a custom tax override.
            </p>
          </div>

          {/* Health Insurance Flat Rate */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
              Health Insurance Flat Rate ($)
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
              <Input
                type="number" min={0}
                value={health}
                onChange={e => setHealth(e.target.value)}
                className="pl-6"
                placeholder="e.g. 50"
              />
            </div>
            <p className="text-xs text-gray-400">
              Fixed monthly deduction for company health plans.
            </p>
          </div>

          {/* Unpaid Leave Per Day */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <UserX className="h-3.5 w-3.5 text-gray-400" />
              Unpaid Leave Deduction ($/day)
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
              <Input
                type="number" min={0}
                value={leave}
                onChange={e => setLeave(e.target.value)}
                className="pl-6"
                placeholder="e.g. 100"
              />
            </div>
            <p className="text-xs text-gray-400">
              Deducted per day of unpaid leave this month.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
            Save Policies
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PrepRow — isolated so it never loses focus on keystroke ─────────────────
function PrepRow({
  employee,
  initialBonus,
  initialLeaveDays,
  onEdit,
}: {
  employee:         User;
  initialBonus:     string;
  initialLeaveDays: string;
  onEdit: (userId: string, field: 'bonus' | 'leaveDays', value: string) => void;
}) {
  const [bonus,     setBonus]     = useState(initialBonus);
  const [leaveDays, setLeaveDays] = useState(initialLeaveDays);
  const name = `${employee.profile.firstName} ${employee.profile.lastName}`;

  return (
    <TableRow className="hover:bg-gray-50/70 transition-colors">
      <TableCell>
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <p className="text-xs text-gray-400">{employee.displayId ?? '—'}</p>
      </TableCell>

      <TableCell className="text-right text-sm text-gray-700 font-medium tabular-nums">
        {fmt(employee.financial?.baseSalary ?? 0)}
      </TableCell>

      {/* Bonus input */}
      <TableCell className="w-[150px]">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
          <Input
            type="number" min={0}
            value={bonus}
            className="pl-6 h-8 text-sm"
            placeholder="0"
            onChange={e => setBonus(e.target.value)}
            onBlur={() => onEdit(employee._id, 'bonus', bonus)}
          />
        </div>
      </TableCell>

      {/* Unpaid leave days input */}
      <TableCell className="w-[140px]">
        <Input
          type="number" min={0}
          value={leaveDays}
          className="h-8 text-sm"
          placeholder="0"
          onChange={e => setLeaveDays(e.target.value)}
          onBlur={() => onEdit(employee._id, 'leaveDays', leaveDays)}
        />
      </TableCell>

      {/* Estimated gross — live, no parent re-render */}
      <TableCell className="text-right text-sm font-semibold text-gray-900 tabular-nums">
        {fmt(Math.max(0, (employee.financial?.baseSalary ?? 0) + (parseFloat(bonus) || 0)))}
        <p className="text-xs font-normal text-gray-400">before deductions</p>
      </TableCell>
    </TableRow>
  );
}

// ─── DepartmentCard — one card per department in the prep view ────────────────
function DepartmentCard({
  dept,
  employees,
  onDeptUpdated,
  prepEditsRef,
  onEdit,
}: {
  dept:         Department | null;   // null = "Unassigned" group
  employees:    User[];
  onDeptUpdated:(updated: Department) => void;
  prepEditsRef: React.MutableRefObject<Record<string, { bonus: string; leaveDays: string }>>;
  onEdit:       (userId: string, field: 'bonus' | 'leaveDays', value: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const isUnassigned = dept === null;

  const totalBase = employees.reduce((s, e) => s + (e.financial?.baseSalary ?? 0), 0);

  return (
    <>
      <Card className="border border-gray-200 shadow-sm">
        {/* ── Card header ─────────────────────────────────────────────────── */}
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3 border-b border-gray-100 bg-gray-50/60 rounded-t-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`rounded-md p-2 shrink-0 ${isUnassigned ? 'bg-gray-200' : 'bg-indigo-100'}`}>
              <Building2 className={`h-4 w-4 ${isUnassigned ? 'text-gray-500' : 'text-indigo-600'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {isUnassigned ? 'Unassigned' : dept!.name}
              </h3>
              <p className="text-xs text-gray-400">
                {employees.length} employee{employees.length !== 1 ? 's' : ''}
                {' · '}
                <span className="tabular-nums">Base total: {fmt(totalBase)}</span>
              </p>
            </div>
          </div>

          {/* Policy pills + edit button — only for real departments */}
          {!isUnassigned && dept && (
            <div className="flex items-center gap-3 shrink-0">
              {/* Policy summary pills */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                  <Percent className="h-2.5 w-2.5" />
                  {dept.payrollSettings.defaultTaxPercentage}% tax
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {fmt(dept.payrollSettings.healthInsuranceFlatRate)} health
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-700">
                  <UserX className="h-2.5 w-2.5" />
                  {fmt(dept.payrollSettings.unpaidLeaveDeductionPerDay)}/day leave
                </span>
              </div>

              <Button
                variant="outline" size="sm"
                className="h-7 text-xs gap-1.5 shrink-0"
                onClick={() => setModalOpen(true)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Edit Policies
              </Button>
            </div>
          )}
        </CardHeader>

        {/* ── Employees table ──────────────────────────────────────────────── */}
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-gray-100">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide pl-4">Employee</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Base Salary</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span className="flex items-center gap-1">
                    <Gift className="h-3 w-3 text-amber-400" />
                    Bonus
                  </span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-red-400" />
                    Unpaid Leave Days
                  </span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right pr-4">Est. Gross</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-xs text-gray-400 italic">
                    No employees in this department.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map(emp => (
                  <PrepRow
                    key={emp._id}
                    employee={emp}
                    initialBonus={prepEditsRef.current[emp._id]?.bonus ?? ''}
                    initialLeaveDays={prepEditsRef.current[emp._id]?.leaveDays ?? ''}
                    onEdit={onEdit}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit policies modal — only mounted for real departments */}
      {!isUnassigned && dept && (
        <EditPoliciesModal
          dept={dept}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={onDeptUpdated}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function PayrollDashboard() {
  const now = new Date();

  // ── Period selection ───────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(now) + 1);
  const [selectedYear,  setSelectedYear]  = useState<number>(getYear(now));
  const periodLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  // ── Review view state ──────────────────────────────────────────────────────
  const [payslips,        setPayslips]        = useState<Payslip[]>([]);
  const [isLoadingSlips,  setIsLoadingSlips]  = useState(true);
  const [actioningId,     setActioningId]     = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isBulkLocking,   setIsBulkLocking]   = useState(false);
  const [isBulkPaying,    setIsBulkPaying]    = useState(false);
  const [searchTerm,      setSearchTerm]      = useState('');

  // ── Prep view state ────────────────────────────────────────────────────────
  const [employees,     setEmployees]     = useState<User[]>([]);
  const [departments,   setDepartments]   = useState<Department[]>([]);
  const [isLoadingPrep, setIsLoadingPrep] = useState(false);
  const [isSavingPrep,  setIsSavingPrep]  = useState(false);

  // prepEditsRef — ref not state, so typing never triggers parent re-render
  const prepEditsRef = useRef<Record<string, { bonus: string; leaveDays: string }>>({});
  const generateTriggerRef = useRef<(() => void) | null>(null);

  // ── Derived view flags ─────────────────────────────────────────────────────
  const hasPayslips = !isLoadingSlips && payslips.length > 0;
  const isPrepView  = !isLoadingSlips && payslips.length === 0;

  // ── Fetch payslips ─────────────────────────────────────────────────────────
  const fetchPayslips = useCallback(async () => {
    try {
      setIsLoadingSlips(true);
      const data = await api.getPayslips(selectedMonth, selectedYear);
      setPayslips(data);
    } catch (err) {
      toast.error('Failed to load payslips', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setPayslips([]);
    } finally {
      setIsLoadingSlips(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    setPayslips([]);
    setSearchTerm('');
    prepEditsRef.current = {};
    fetchPayslips();
  }, [fetchPayslips]);

  // ── Fetch employees + departments in parallel when Prep view is active ─────
  useEffect(() => {
    if (!isPrepView) return;
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoadingPrep(true);
        // Both fetches fire simultaneously — faster than sequential
        const [empData, deptData] = await Promise.all([
          api.getEmployees(),
          api.getDepartments(),
        ]);
        console.log(empData,deptData) ; 
        if (!cancelled) {
          setEmployees(empData.filter(e => !e.isDeleted));
          setDepartments(deptData);
        }
      } catch (err) {
        if (!cancelled)
          toast.error('Failed to load payroll data', {
            description: err instanceof Error ? err.message : 'Unknown error',
          });
      } finally {
        if (!cancelled) setIsLoadingPrep(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isPrepView]);

  // ── Group employees by department ─────────────────────────────────────────
  // Returns: { dept: Department, employees: User[] }[]
  // + a trailing "Unassigned" entry if any employees have no departmentId
  const groupedData = useMemo(() => {
    if (employees.length === 0) return [];

    // Build a map: deptId → employees[]
    const map = new Map<string, User[]>();
    const unassigned: User[] = [];

    employees.forEach(emp => {
      const deptId = emp.departmentId
        ? (typeof emp.departmentId === 'object'
            ? (emp.departmentId as any)._id ?? String(emp.departmentId)
            : String(emp.departmentId))
        : null;

      if (!deptId) {
        unassigned.push(emp);
      } else {
        if (!map.has(deptId)) map.set(deptId, []);
        map.get(deptId)!.push(emp);
      }
    });

    // Build result array — one entry per department (in sorted order)
    const result: { dept: Department | null; employees: User[] }[] = departments
      .filter(d => map.has(d._id))
      .map(d => ({ dept: d, employees: map.get(d._id)! }));

    // Add unassigned group at the bottom if it has members
    if (unassigned.length > 0) {
      result.push({ dept: null, employees: unassigned });
    }

    return result;
  }, [employees, departments]);

  // ── Update a department in local state after policy save ──────────────────
  const handleDeptUpdated = useCallback((updated: Department) => {
    setDepartments(prev => prev.map(d => d._id === updated._id ? updated : d));
  }, []);

  // ── Prep edit handler (called on input blur) ───────────────────────────────
  const handlePrepEdit = useCallback(
    (userId: string, field: 'bonus' | 'leaveDays', value: string) => {
      prepEditsRef.current[userId] = {
        ...(prepEditsRef.current[userId] ?? { bonus: '0', leaveDays: '0' }),
        [field]: value,
      };
    },
    []
  );

  // ── Save & Run ─────────────────────────────────────────────────────────────
  const handleSaveAndRun = async () => {
    try {
      setIsSavingPrep(true);
      const edits    = prepEditsRef.current;
      const dirtyIds = Object.keys(edits).filter(
        id =>
          parseFloat(edits[id].bonus     || '0') !== 0 ||
          parseFloat(edits[id].leaveDays || '0') !== 0
      );

      if (dirtyIds.length > 0) {
        toast.loading(`Saving ${dirtyIds.length} variable(s)…`, { id: 'prep-save' });
        await Promise.all(
          dirtyIds.map(userId =>
            api.updateUserMonthlyVars(userId, {
              bonusThisMonth:           parseFloat(edits[userId].bonus     || '0'),
              unpaidLeaveDaysThisMonth: parseFloat(edits[userId].leaveDays || '0'),
            })
          )
        );
        toast.success('Variables saved.', { id: 'prep-save' });
      }

      // Trigger PayrollGenerator (opens progress modal + starts polling)
      generateTriggerRef.current?.();

    } catch (err) {
      toast.error('Failed to save prep variables', {
        description: err instanceof Error ? err.message : 'Unknown error',
        id: 'prep-save',
      });
    } finally {
      setIsSavingPrep(false);
    }
  };

  // ── Review view derived values ─────────────────────────────────────────────
  const draftCount     = useMemo(() => payslips.filter(p => p.status === 'draft'    ).length, [payslips]);
  const processedCount = useMemo(() => payslips.filter(p => p.status === 'processed').length, [payslips]);
  const paidCount      = useMemo(() => payslips.filter(p => p.status === 'paid'     ).length, [payslips]);
  const totalNetPay    = useMemo(() => payslips.reduce((s, p) => s + (p.netPay ?? 0), 0), [payslips]);

  const filteredPayslips = useMemo(() => {
    if (!searchTerm.trim()) return payslips;
    const q = searchTerm.toLowerCase();
    return payslips.filter(p => {
      const emp = typeof p.employeeId === 'object' ? p.employeeId : null;
      if (!emp) return false;
      const name = `${emp.profile.firstName} ${emp.profile.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        (emp.displayId ?? '').toLowerCase().includes(q) ||
        (emp.email     ?? '').toLowerCase().includes(q)
      );
    });
  }, [payslips, searchTerm]);

  // ── Status update handlers ─────────────────────────────────────────────────
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

  const handleBulkLock = async () => {
    try {
      setIsBulkLocking(true);
      const result = await api.bulkLockPayslips(selectedMonth, selectedYear);
      toast.success(`${result.modifiedCount} payslips locked`);
      await fetchPayslips();
    } catch (err) {
      toast.error('Bulk lock failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsBulkLocking(false);
    }
  };

  const handleBulkPay = async () => {
    try {
      setIsBulkPaying(true);
      const result = await api.bulkPayPayslips(selectedMonth, selectedYear);
      toast.success(`${result.modifiedCount} payslips marked as paid`);
      await fetchPayslips();
    } catch (err) {
      toast.error('Bulk pay failed', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsBulkPaying(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ════════════════════════════════════════════════════════════════════
          FIXED HEADER — always visible
          ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {hasPayslips
              ? `Reviewing payslips for ${periodLabel}.`
              : `Prepare and generate payroll for ${periodLabel}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk action buttons — review view only */}
          {hasPayslips && draftCount > 0 && (
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

          {hasPayslips && processedCount > 0 && (
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

          {/* Period selectors */}
          <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* PayrollGenerator — hidden in prep view, triggered via ref */}
          <PayrollGenerator
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            onComplete={fetchPayslips}
            onRegisterTrigger={(fn) => { generateTriggerRef.current = fn; }}
            hidden={isPrepView}
          />
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoadingSlips && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          REVIEW VIEW
          ════════════════════════════════════════════════════════════════════ */}
      {hasPayslips && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryCard label="Total Payroll"  value={fmt(totalNetPay)}         icon={<DollarSign className="h-4 w-4 text-indigo-600" />} color="bg-indigo-50" />
            <SummaryCard label="Draft"          value={draftCount.toString()}     icon={<FileText   className="h-4 w-4 text-gray-500"   />} color="bg-gray-100"  />
            <SummaryCard label="Processed"      value={processedCount.toString()} icon={<Lock       className="h-4 w-4 text-blue-600"   />} color="bg-blue-50"   />
            <SummaryCard label="Paid"           value={paidCount.toString()}      icon={<CheckCircle className="h-4 w-4 text-green-600" />} color="bg-green-50"  />
          </div>

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

          {/* Payslips table */}
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
                    {filteredPayslips.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-gray-400">
                          No payslips match "{searchTerm}"
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayslips.map(payslip => {
                        const emp             = typeof payslip.employeeId === 'object' ? payslip.employeeId : null;
                        const name            = emp ? `${emp.profile.firstName} ${emp.profile.lastName}` : '—';
                        const totalEarnings   = payslip.earnings.bonus + payslip.earnings.allowances;
                        const totalDeductions = payslip.deductions.tax + payslip.deductions.healthInsurance + payslip.deductions.unpaidLeave;
                        const isActioning     = actioningId === payslip._id;

                        return (
                          <TableRow key={payslip._id} className="hover:bg-gray-50 transition-colors">
                            <TableCell>
                              <p className="text-sm font-medium text-gray-900">{name}</p>
                              {emp?.displayId && <p className="text-xs text-gray-400">{emp.displayId}</p>}
                            </TableCell>
                            <TableCell className="text-right text-sm text-gray-600 tabular-nums">
                              {fmt(payslip.earnings.baseSalary)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-green-700 tabular-nums">
                              {totalEarnings > 0 ? `+${fmt(totalEarnings)}` : '—'}
                            </TableCell>
                            <TableCell className="text-right text-sm text-red-600 tabular-nums">
                              {totalDeductions > 0 ? `−${fmt(totalDeductions)}` : '—'}
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold text-gray-900 tabular-nums">
                              {fmt(payslip.netPay ?? 0)}
                            </TableCell>
                            <TableCell><StatusBadge status={payslip.status} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {payslip.status === 'draft' && (
                                  <>
                                    <Button
                                      size="sm" variant="outline" className="h-7 text-xs"
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
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          PREP VIEW — grouped by department
          ════════════════════════════════════════════════════════════════════ */}
      {isPrepView && (
        <div className="space-y-5">

          {/* ── Top action bar ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <div className="text-sm text-indigo-800">
                <p className="font-semibold">Payroll Preparation — {periodLabel}</p>
                <p className="text-indigo-600 text-xs mt-0.5">
                  Review department policies, set bonuses or unpaid leave, then run payroll.
                </p>
              </div>
            </div>

            {/* ── Global "Save & Run" — outside department cards ─────────── */}
            <Button
              size="sm"
              className="shrink-0"
              disabled={isSavingPrep || isLoadingPrep}
              onClick={handleSaveAndRun}
            >
              {isSavingPrep
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <ChevronRight className="mr-1.5 h-4 w-4" />}
              Save &amp; Run Payroll
            </Button>
          </div>

          {/* ── Department cards ─────────────────────────────────────────── */}
          {isLoadingPrep ? (
            // Skeleton cards while loading
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border border-gray-200">
                  <CardHeader className="pb-3">
                    <Skeleton className="h-5 w-40 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableBody><TableSkeleton cols={5} /></TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : groupedData.length === 0 ? (
            <Card className="border border-dashed border-gray-300">
              <CardContent className="py-16 text-center">
                <Users className="mx-auto h-8 w-8 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">No active employees found.</p>
                <p className="text-xs text-gray-400 mt-1">Add employees to get started.</p>
              </CardContent>
            </Card>
          ) : (
            groupedData.map(({ dept, employees: deptEmps }) => (
              <DepartmentCard
                key={dept ? dept._id : '__unassigned__'}
                dept={dept}
                employees={deptEmps}
                onDeptUpdated={handleDeptUpdated}
                prepEditsRef={prepEditsRef}
                onEdit={handlePrepEdit}
              />
            ))
          )}
        </div>
      )}

      {/* Edit payslip modal — review view */}
      <EditPayslipModal
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        payslip={selectedPayslip}
        onSuccess={fetchPayslips}
      />
    </div>
  );
}