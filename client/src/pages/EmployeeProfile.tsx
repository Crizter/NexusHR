import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { mockApi } from '@/lib/mockApi';
import type { User as Employee, LeaveRequest } from '@/lib/mockApi';
import { PERMISSIONS } from '@/lib/config';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Wallet,
  Calendar,
  User,
  XCircle,
  Check,
  X,
  Clock,
} from 'lucide-react';

// ─── Role badge styles ────────────────────────────────────────────────────────
const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-red-100  text-red-800  hover:bg-red-100',
  hr_manager:  'bg-blue-100 text-blue-800 hover:bg-blue-100',
  manager:     'bg-purple-100 text-purple-800 hover:bg-purple-100',
  employee:    'bg-gray-100 text-gray-800 hover:bg-gray-100',
};

// ─── Status badge helper ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LeaveRequest['status'] }) {
  const MAP = {
    pending:   { icon: Clock, label: 'Pending',   cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    approved:  { icon: Check, label: 'Approved',  cls: 'bg-green-100  text-green-800  border-green-200'  },
    rejected:  { icon: X,     label: 'Rejected',  cls: 'bg-red-100    text-red-800    border-red-200'    },
    cancelled: { icon: X,     label: 'Cancelled', cls: 'bg-gray-100   text-gray-600   border-gray-200'   },
  } as const;

  const { icon: Icon, label, cls } = MAP[status];

  return (
    <Badge className={`${cls} hover:${cls} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// ─── Format currency ──────────────────────────────────────────────────────────
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Initials helper ──────────────────────────────────────────────────────────
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ─── Skeleton layout ──────────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back button skeleton */}
      <Skeleton className="h-9 w-36" />

      {/* Profile header card skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Skeleton className="h-20 w-20 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
              <Skeleton className="h-4 w-24 mx-auto sm:mx-0" />
              <Skeleton className="h-5 w-20 mx-auto sm:mx-0 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Leave row ────────────────────────────────────────────────────────────────
function LeaveRow({ leave }: { leave: LeaveRequest }) {
  const isSingleDay = leave.dates.totalDays === 1;
  const dateLabel   = isSingleDay
    ? format(new Date(leave.dates.startDate), 'MMM dd, yyyy')
    : `${format(new Date(leave.dates.startDate), 'MMM dd')} – ${format(new Date(leave.dates.endDate), 'MMM dd, yyyy')}`;

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-0 gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
          <Calendar className="h-4 w-4 text-gray-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 capitalize">
            {leave.type === 'casual_leave' ? 'Casual Leave' : 'Sick Leave'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{dateLabel}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
            {leave.reason}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <StatusBadge status={leave.status} />
        <span className="text-xs text-gray-400">
          {leave.dates.totalDays}d
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function EmployeeProfile() {
  const { id }          = useParams<{ id: string }>();
  const navigate        = useNavigate();
  const { user, hasPermission } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [employee,     setEmployee]     = useState<Employee | null>(null);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [loading,      setLoading]      = useState<boolean>(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── RBAC ───────────────────────────────────────────────────────────────────
  // Can view financials if user has edit permission OR is viewing their own profile
  const canViewFinancials =
    hasPermission(PERMISSIONS.EDIT_RECORD) || user?.id === id;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.orgId || !id) return;

      try {
        setLoading(true);
        setError(null);

        const [emp, leaves] = await Promise.all([
          mockApi.getEmployeeById(user.orgId, id),
          mockApi.getLeaves(user.orgId, id),
        ]);

        setEmployee(emp);
        setRecentLeaves(leaves);

      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load employee profile'
        );
        console.error('EmployeeProfile fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [id, user?.orgId]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) return <ProfileSkeleton />;

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !employee) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {error ?? 'Employee not found'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            The profile you're looking for doesn't exist or was removed.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/employees')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const fullName  = `${employee.profile.firstName} ${employee.profile.lastName}`;
  const initials  = getInitials(employee.profile.firstName, employee.profile.lastName);
  const isSelf    = user?.id === id;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Back navigation ──────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/employees')}
        className="gap-2 text-gray-600 hover:text-gray-900 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Directory
      </Button>

      {/* ── Profile header card ───────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Decorative top band */}
        <div className="h-2 w-full bg-gradient-to-r from-gray-800 to-gray-600" />

        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">

            {/* Avatar */}
            <Avatar className="h-20 w-20 shrink-0 ring-4 ring-white shadow-md">
              <AvatarImage
                src={employee.profile.avatarUrl}
                alt={fullName}
              />
              <AvatarFallback className="bg-gray-200 text-gray-700 text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Name / meta */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
                {isSelf && (
                  <span className="text-xs text-gray-400 font-normal mt-0.5 sm:mt-0">
                    (You)
                  </span>
                )}
              </div>

              <p className="mt-1 font-mono text-xs text-gray-500">
                {employee.displayId}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Badge
                  className={
                    ROLE_BADGE_STYLES[employee.role] ??
                    'bg-gray-100 text-gray-800'
                  }
                >
                  {employee.role.replace(/_/g, ' ')}
                </Badge>

                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Building className="h-3 w-3" />
                  {employee.departmentId}
                </span>
              </div>
            </div>

            {/* Member since */}
            <div className="shrink-0 text-center sm:text-right">
              <p className="text-xs text-gray-400">Member since</p>
              <p className="text-sm font-medium text-gray-700 mt-0.5">
                {format(new Date(employee.createdAt), 'MMM yyyy')}
              </p>
              {employee.lastLogin && (
                <>
                  <p className="text-xs text-gray-400 mt-2">Last active</p>
                  <p className="text-sm font-medium text-gray-700 mt-0.5">
                    {format(new Date(employee.lastLogin), 'MMM dd, yyyy')}
                  </p>
                </>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">

          {/* Contact card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <User className="h-4 w-4 text-gray-500" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Email */}
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm text-gray-900 break-all">
                    {employee.email}
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="text-sm text-gray-900">
                    {employee.profile.contactNumber || '—'}
                  </p>
                </div>
              </div>

              {/* Department */}
              <div className="flex items-start gap-3">
                <Building className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Department</p>
                  <p className="text-sm text-gray-900">
                    {employee.departmentId}
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Leave Balances card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Calendar className="h-4 w-4 text-gray-500" />
                Leave Balances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">

              {/* Casual */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-sm text-gray-700">Casual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-900">
                    {employee.leaveBalances.casual}
                  </span>
                  <span className="text-xs text-gray-400">days left</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-blue-400 transition-all"
                  style={{ width: `${(employee.leaveBalances.casual / 12) * 100}%` }}
                />
              </div>

              {/* Sick */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="text-sm text-gray-700">Sick</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-900">
                    {employee.leaveBalances.sick}
                  </span>
                  <span className="text-xs text-gray-400">days left</span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-green-400 transition-all"
                  style={{ width: `${(employee.leaveBalances.sick / 10) * 100}%` }}
                />
              </div>

            </CardContent>
          </Card>

          {/* Financials card — RBAC guarded */}
          {canViewFinancials && (
            <Card className="border-dashed border-gray-300">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Wallet className="h-4 w-4 text-gray-500" />
                  Financials
                  {isSelf && (
                    <span className="ml-auto text-[10px] font-normal text-gray-400">
                      Visible to you only
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    employee.financial.baseSalary,
                    employee.financial.currency
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Base salary · {employee.financial.currency}
                </p>
              </CardContent>
            </Card>
          )}

        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="leaves">
            <TabsList className="bg-gray-100 mb-4">
              <TabsTrigger value="leaves" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Leave History
                {recentLeaves.length > 0 && (
                  <span className="ml-1 rounded-full bg-gray-300 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 leading-none">
                    {recentLeaves.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Leaves tab */}
            <TabsContent value="leaves">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-900">
                    All Leave Requests
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6">
                  {recentLeaves.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        No leave requests
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        This employee hasn't applied for any leave yet.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {recentLeaves.map((leave) => (
                        <LeaveRow key={leave._id} leave={leave} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  );
}