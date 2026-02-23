import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';                          // ← real API
import type { User } from '@/lib/api';
import { PERMISSIONS } from '@/lib/config';
import { AddEmployeeDialog } from '@/components/directory/AddEmployeeDialog';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
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
const ROWS_PER_PAGE_OPTIONS = [5, 10, 20] as const;
const DEFAULT_PAGE_SIZE     = 10;

const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-red-100    text-red-800    hover:bg-red-100',
  hr_manager:  'bg-blue-100   text-blue-800   hover:bg-blue-100',
  manager:     'bg-purple-100 text-purple-800 hover:bg-purple-100',
  employee:    'bg-gray-100   text-gray-800   hover:bg-gray-100',
};

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell>
    </TableRow>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={5}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">
            {hasSearch ? 'No employees found' : 'No employees yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {hasSearch
              ? 'Try adjusting your search.'
              : 'Add your first employee to get started.'}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function EmployeeDirectory() {
  const { user, hasPermission } = useAuth();
  const navigate                = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [employees,   setEmployees]   = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [dialogOpen,  setDialogOpen]  = useState(false);

  // Delete confirmation dialog
  const [deleteTarget,    setDeleteTarget]    = useState<User | null>(null);
  const [deleteLoading,   setDeleteLoading]   = useState(false);
  const [deleteError,     setDeleteError]     = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(DEFAULT_PAGE_SIZE);

  // ── RBAC ───────────────────────────────────────────────────────────────────
  const canDelete    = hasPermission(PERMISSIONS.DELETE_RECORD);
  const canAdd       = hasPermission(PERMISSIONS.ADD_PROFILE);
  const hasActions   = canDelete;

  // ── Fetch employees ────────────────────────────────────────────────────────
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getEmployees();        // ← no orgId needed
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchEmployees();
  }, [user]);

  // Reset page on search
  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !user) return;

    try {
      setDeleteLoading(true);
      setDeleteError(null);

      await api.deleteEmployee(user.orgId, deleteTarget._id);
      setEmployees(prev => prev.filter(e => e._id !== deleteTarget._id));

      // ── Success toast ─────────────────────────────────────────────────
      toast.success('Employee removed', {
        description: `${deleteTarget.profile.firstName} ${deleteTarget.profile.lastName} has been removed from the directory.`,
        duration: 4000,
      });

      setDeleteTarget(null);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete employee';
      setDeleteError(msg);

      // ── Error toast ───────────────────────────────────────────────────
      toast.error('Failed to remove employee', {
        description: msg,
        duration: 5000,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Filtered + paginated rows ──────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(emp =>
      emp.profile.firstName.toLowerCase().includes(q) ||
      emp.profile.lastName.toLowerCase().includes(q)  ||
      emp.email.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const totalPages    = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const safePage      = Math.min(currentPage, totalPages);
  const paginatedRows = filteredEmployees.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
        <Button size="sm" variant="outline" className="ml-auto" onClick={fetchEmployees}>
          Retry
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Directory</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage and view all employees in your organization.
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {canAdd && (
          <Button className="flex items-center gap-2 shrink-0" onClick={() => setDialogOpen(true)}>
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
              {hasActions && (
                <TableHead className="w-[60px] font-semibold text-gray-700 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filteredEmployees.length === 0 && (
              <EmptyState hasSearch={searchQuery.trim().length > 0} />
            )}

            {!loading && paginatedRows.map((emp) => (
              <TableRow
                key={emp._id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/employees/${emp._id}`)}
              >
                <TableCell className="font-mono text-xs text-gray-500">
                  {emp.displayId}
                </TableCell>

                <TableCell>
                  <p className="text-sm font-medium text-gray-900">
                    {emp.profile.firstName} {emp.profile.lastName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{emp.email}</p>
                </TableCell>

                <TableCell className="text-sm text-gray-600">
                  {emp.departmentId}
                </TableCell>

                <TableCell>
                  <Badge className={ROLE_BADGE_STYLES[emp.role] ?? 'bg-gray-100 text-gray-800'}>
                    {emp.role.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>

                {hasActions && (
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuLabel className="text-xs text-gray-500">Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {canDelete && (
                          <DropdownMenuItem
                            onClick={() => { setDeleteTarget(emp); setDeleteError(null); }}
                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && filteredEmployees.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <span className="font-medium text-gray-900">{(safePage - 1) * pageSize + 1}</span>
              {' '}-{' '}
              <span className="font-medium text-gray-900">
                {Math.min(safePage * pageSize, filteredEmployees.length)}
              </span>
              {' '}of{' '}
              <span className="font-medium text-gray-900">{filteredEmployees.length}</span>
              {' '}employees
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-sm focus:outline-none"
              >
                {ROWS_PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - safePage) <= 1)
              .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis'
                  ? <span key={`e-${idx}`} className="px-1 text-gray-400">...</span>
                  : (
                    <Button key={item} variant={safePage === item ? 'default' : 'outline'}
                      size="sm" className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(item)}
                    >
                      {item}
                    </Button>
                  )
              )}

            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Employee Dialog */}
      <AddEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchEmployees}           // ← re-fetch after add
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-gray-900">
                {deleteTarget?.profile.firstName} {deleteTarget?.profile.lastName}
              </span>
              ? This action cannot be undone.
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
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
                : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}