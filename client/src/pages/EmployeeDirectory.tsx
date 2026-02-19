import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { mockApi } from '@/lib/mockApi';
import type { User } from '@/lib/mockApi';
import { PERMISSIONS } from '@/lib/config';
import { AddEmployeeDialog } from '@/components/directory/AddEmployeeDialog';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  Users,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROWS_PER_PAGE_OPTIONS = [5, 10, 20] as const;
const DEFAULT_PAGE_SIZE = 10;

// ─── Role badge styling map ────────────────────────────────────────────────────
const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800 hover:bg-red-100',
  hr_manager:  'bg-blue-100 text-blue-800 hover:bg-blue-100',
  employee:    'bg-gray-100 text-gray-800 hover:bg-gray-100',
};




// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow>
      {/* Employee ID */}
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>

      {/* Name & Email stacked */}
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </TableCell>

      {/* Department */}
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>

      {/* Role badge */}
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>

      {/* Actions */}
      <TableCell>
        <Skeleton className="h-8 w-8 rounded-md" />
      </TableCell>
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
              ? 'Try adjusting your search to find who you are looking for.'
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

  // ── State ──────────────────────────────────────────────────────────────────
  const [employees, setEmployees]     = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading]         = useState<boolean>(true);
  const [error, setError]             = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const navigate = useNavigate() ; 
    // ── Dialog state ───────────────────────────────────────────────────────────
  // Called by the dialog on successful save — re-fetches the table
  const handleEmployeeAdded = async () => {
    if (!user?.orgId) return;
    try {
      const data = await mockApi.getEmployees(user.orgId);
      setEmployees(data);
    } catch (err) {
      console.error('Re-fetch after add failed:', err);
    }
  };




  // Pagination state
  const [currentPage, setCurrentPage]   = useState<number>(1);
  const [pageSize, setPageSize]         = useState<number>(DEFAULT_PAGE_SIZE);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!user?.orgId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await mockApi.getEmployees(user.orgId);
        setEmployees(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load employees'
        );
        console.error('EmployeeDirectory fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [user?.orgId]);

  // ── Derived: search filter ─────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;

    const query = searchQuery.toLowerCase().trim();
    return employees.filter(
      (emp) =>
        emp.profile.firstName.toLowerCase().includes(query) ||
        emp.profile.lastName.toLowerCase().includes(query)  ||
        emp.email.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

 

  // ── Derived: pagination ────────────────────────────────────────────────────
  const totalPages    = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const safePage      = Math.min(currentPage, totalPages);
  const paginatedRows = filteredEmployees.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  // Reset to page 1 whenever the search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const canEdit   = hasPermission(PERMISSIONS.EDIT_RECORD);
  const canDelete = hasPermission(PERMISSIONS.DELETE_RECORD);
  const canAdd    = hasPermission(PERMISSIONS.ADD_PROFILE);
  const hasActions = canEdit || canDelete;

  const handleEdit = (emp: User) => {
    // TODO: open edit modal / navigate to edit page
    console.log('Edit employee:', emp._id);
  };

  const handleDelete = (emp: User) => {
    // TODO: open confirmation dialog then call mockApi.deleteEmployee
    console.log('Delete employee:', emp._id);
  };

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee Directory</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage and view all employees in your organization.
        </p>
      </div>

      {/* ── Action Bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input — unchanged */}
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Add Employee button now opens the dialog */}
        {canAdd && (
          <Button            
            className="flex items-center gap-2 shrink-0"
            onClick={() => setDialogOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      {/* ── Table Card ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="w-[120px] font-semibold text-gray-700">
                Employee ID
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Name &amp; Email
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Department
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Role
              </TableHead>
              {hasActions && (
                <TableHead className="w-[60px] font-semibold text-gray-700 text-right">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* ── Skeleton rows while loading ────────────────────────────── */}
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}

            {/* ── Empty state ────────────────────────────────────────────── */}
            {!loading && filteredEmployees.length === 0 && (
              <EmptyState hasSearch={searchQuery.trim().length > 0} />
            )}

            {/* ── Data rows ──────────────────────────────────────────────── */}
            {!loading &&
              paginatedRows.map((emp) => (
                 <TableRow
                  key={emp._id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/employees/${emp._id}`)}
                >
                  {/* Employee ID */}
                  <TableCell className="font-mono text-xs text-gray-500">
                    {emp.displayId}
                  </TableCell>

                  {/* Name & Email stacked */}
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {emp.profile.firstName} {emp.profile.lastName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {emp.email}
                      </p>
                    </div>
                  </TableCell>

                  {/* Department */}
                  <TableCell className="text-sm text-gray-600">
                    {emp.departmentId}
                  </TableCell>

                  {/* Role badge */}
                  <TableCell>
                    <Badge
                      className={
                        ROLE_BADGE_STYLES[emp.role] ??
                        'bg-gray-100 text-gray-800 hover:bg-gray-100'
                      }
                    >
                      {emp.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>

                  {/* Actions dropdown — RBAC guarded */}
                  {hasActions && (
                    <TableCell 
                    onClick={(e) => e.stopPropagation()}
                    className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label="Open actions menu"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuLabel className="text-xs text-gray-500">
                            Actions
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {canEdit && (
                            <DropdownMenuItem
                              onClick={() => handleEdit(emp)}
                              className="cursor-pointer"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}

                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(emp)}
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

      {/* ── Pagination Bar ───────────────────────────────────────────────── */}
      {!loading && filteredEmployees.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">

          {/* Left: result count + rows-per-page selector */}
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <span className="font-medium text-gray-900">
                {(safePage - 1) * pageSize + 1}
              </span>{' '}
              -{' '}
              <span className="font-medium text-gray-900">
                {Math.min(safePage * pageSize, filteredEmployees.length)}
              </span>{' '}
              of{' '}
              <span className="font-medium text-gray-900">
                {filteredEmployees.length}
              </span>{' '}
              employees
            </span>

            {/* Rows per page */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded border border-gray-200 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: prev / page numbers / next */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="h-8 w-8 p-0"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page number pills */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                // Always show first, last, current and neighbours
                return (
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - safePage) <= 1
                );
              })
              .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                  acc.push('ellipsis');
                }
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-gray-400">
                    ...
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={safePage === item ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(item)}
                    className="h-8 w-8 p-0"
                    aria-label={`Page ${item}`}
                    aria-current={safePage === item ? 'page' : undefined}
                  >
                    {item}
                  </Button>
                )
              )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="h-8 w-8 p-0"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
       <AddEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleEmployeeAdded}
      />
    </div>
  );
}