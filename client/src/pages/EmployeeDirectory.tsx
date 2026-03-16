import { useEffect, useState, useRef }   from 'react';
import { useAuth }                       from '@/context/AuthContext';
import { api }                           from '@/lib/api';
import type { User, Department }         from '@/lib/api';
import { PERMISSIONS }                   from '@/lib/config';
import { AddEmployeeDialog }             from '@/components/directory/AddEmployeeDialog';
import { useNavigate }                   from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input }    from '@/components/ui/input';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search, MoreHorizontal, Trash2, UserPlus, Users,
  ChevronLeft, ChevronRight, XCircle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-red-100    text-red-800    hover:bg-red-100',
  hr_manager:  'bg-blue-100   text-blue-800   hover:bg-blue-100',
  manager:     'bg-purple-100 text-purple-800 hover:bg-purple-100',
  employee:    'bg-gray-100   text-gray-800   hover:bg-gray-100',
};

const PAGE_LIMIT = 10;

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><div className="space-y-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-48" /></div></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell>
    </TableRow>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={5}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            {hasFilters ? 'No employees match your search' : 'No employees yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {hasFilters ? 'Try adjusting your search or filter.' : 'Add your first employee to get started.'}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function EmployeeDirectory() {
  const { user, hasPermission } = useAuth();
  const navigate                = useNavigate();

  // ── RBAC ───────────────────────────────────────────────────────────────────
  const canDelete  = hasPermission(PERMISSIONS.DELETE_RECORD);
  const canAdd     = hasPermission(PERMISSIONS.ADD_PROFILE);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [searchInput,   setSearchInput]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deptFilter,    setDeptFilter]    = useState('');
  const [departments,   setDepartments]   = useState<Department[]>([]);

  // ── Pagination state ───────────────────────────────────────────────────────
  const [employees,     setEmployees]     = useState<User[]>([]);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [nextCursor,    setNextCursor]    = useState<string | null>(null);
  const [hasNextPage,   setHasNextPage]   = useState(false);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteLoading,setDeleteLoading]= useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);

  // ── Debounce search ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  // ── Reset cursor when filters change ──────────────────────────────────────
  const prevFilters = useRef({ debouncedSearch, deptFilter });
  useEffect(() => {
    const p = prevFilters.current;
    if (p.debouncedSearch !== debouncedSearch || p.deptFilter !== deptFilter) {
      prevFilters.current = { debouncedSearch, deptFilter };
      setCurrentCursor(null);
      setCursorHistory([]);
    }
  }, [debouncedSearch, deptFilter]);

  // ── Fetch departments once ─────────────────────────────────────────────────
  useEffect(() => {
    api.getDepartments()
      .then(d => setDepartments(d ?? []))
      .catch(() => {});
  }, []);

  // ── Fetch employees ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await api.getEmployeeDirectory({
          cursor:       currentCursor ?? undefined,
          search:       debouncedSearch || undefined,
          departmentId: deptFilter     || undefined,
          limit:        PAGE_LIMIT,
        });
        if (!cancelled) {
          setEmployees(result.data);
          setNextCursor(result.nextCursor);
          setHasNextPage(result.hasNextPage);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load employees');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user, currentCursor, debouncedSearch, deptFilter]);

  // ── Pagination handlers ────────────────────────────────────────────────────
  const handleNext = () => {
    setCursorHistory(h => [...h, currentCursor]);
    setCurrentCursor(nextCursor);
  };
  const handlePrev = () => {
    const h    = [...cursorHistory];
    const prev = h.pop() ?? null;
    setCursorHistory(h);
    setCurrentCursor(prev);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !user) return;
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      await api.deleteEmployee(user.orgId, deleteTarget._id);
      setEmployees(prev => prev.filter(e => e._id !== deleteTarget._id));
      toast.success('Employee removed', {
        description: `${deleteTarget.profile.firstName} ${deleteTarget.profile.lastName} has been removed.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete employee';
      setDeleteError(msg);
      toast.error('Failed to remove employee', { description: msg });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentPage  = cursorHistory.length + 1;
  const hasFilters   = !!debouncedSearch || !!deptFilter;

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Directory</h1>
        <p className="mt-1 text-sm text-gray-500">Manage and view all employees in your organization.</p>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search by name, email or ID..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Department filter */}
        <Select value={deptFilter || 'all'} onValueChange={v => setDeptFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map(d => (
              <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canAdd && (
          <Button className="flex items-center gap-2 ml-auto shrink-0" onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[120px] font-semibold text-gray-700">Employee ID</TableHead>
              <TableHead className="font-semibold text-gray-700">Name &amp; Email</TableHead>
              <TableHead className="font-semibold text-gray-700">Department</TableHead>
              <TableHead className="font-semibold text-gray-700">Role</TableHead>
              {canDelete && <TableHead className="w-[60px] font-semibold text-gray-700 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!isLoading && employees.length === 0 && <EmptyState hasFilters={hasFilters} />}

            {!isLoading && employees.map(emp => {
              // departmentId is populated — could be object or string
              const deptName = typeof emp.departmentId === 'object' && emp.departmentId !== null
                ? (emp.departmentId as unknown as { name: string }).name
                : '—';

              return (
                <TableRow
                  key={emp._id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/employees/${emp._id}`)}
                >
                  <TableCell className="font-mono text-xs text-gray-500">{emp.displayId}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-gray-900">
                      {emp.profile.firstName} {emp.profile.lastName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{emp.email}</p>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{deptName}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_BADGE_STYLES[emp.role] ?? 'bg-gray-100 text-gray-800'}>
                      {emp.role.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  {canDelete && (
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuLabel className="text-xs text-gray-500">Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => { setDeleteTarget(emp); setDeleteError(null); }}
                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && (cursorHistory.length > 0 || hasNextPage) && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>Page {currentPage}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0 || isLoading}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasNextPage || isLoading}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => { setCurrentCursor(null); setCursorHistory([]); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-gray-900">
                {deleteTarget?.profile.firstName} {deleteTarget?.profile.lastName}
              </span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <XCircle className="h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{deleteError}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}