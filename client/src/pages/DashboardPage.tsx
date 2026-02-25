import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api, type DashboardStats, type LeaveRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Calendar,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
} from 'lucide-react';

interface RecentActivity {
  id:        string;
  type:      'leave_request' | 'employee_added' | 'leave_approved' | 'leave_rejected';
  message:   string;
  timestamp: Date;
  user:      string;
}

export function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const navigate                = useNavigate();

  const [stats,          setStats]          = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // ── Real API calls  ───────────
        const [dashboardStats, leaves, employees] = await Promise.all([
          api.getDashboardStats(), 
          api.getLeaves(user.orgId),
          api.getEmployees(),         
        ]);
        console.log(dashboardStats);
        setStats(dashboardStats);

        // ── Build recent activity feed from real data ──────────────────────
        const activity: RecentActivity[] = [];

        leaves.slice(0, 5).forEach((leave: LeaveRequest) => {
          if (leave.status === 'pending') {
            activity.push({
              id:        `leave-${leave._id}`,
              type:      'leave_request',
              message:   `submitted a ${leave.type.replace('_', ' ')} request`,
              timestamp: new Date(leave.createdAt),
              user:      leave.employeeName,
            });
          } else if (leave.workflow) {
            activity.push({
              id:        `leave-action-${leave._id}`,
              type:      leave.status === 'approved' ? 'leave_approved' : 'leave_rejected',
              message:   `${leave.type.replace('_', ' ')} request was ${leave.status}`,
              timestamp: new Date(leave.workflow.actionedAt),
              user:      leave.employeeName,
            });
          }
        });

        employees
          .filter(emp => {
            const daysSinceCreated =
              (Date.now() - new Date(emp.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceCreated <= 7;
          })
          .forEach(emp => {
            activity.push({
              id:        `employee-${emp._id}`,
              type:      'employee_added',
              message:   'joined the organization',
              timestamp: new Date(emp.createdAt),
              user:      `${emp.profile.firstName} ${emp.profile.lastName}`,
            });
          });

        activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setRecentActivity(activity.slice(0, 6));

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);   // ← was user?.orgId — user object is enough now

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'leave_request':  return <Clock        className="h-3 w-3 text-orange-500" />;
      case 'leave_approved': return <CheckCircle  className="h-3 w-3 text-green-500"  />;
      case 'leave_rejected': return <XCircle      className="h-3 w-3 text-red-500"    />;
      case 'employee_added': return <Users        className="h-3 w-3 text-blue-500"   />;
      default:               return <AlertCircle  className="h-3 w-3 text-gray-500"   />;
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffInSeconds < 60)    return 'Just now';
    if (diffInSeconds < 3600)  return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  // ── Page ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Welcome header ────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600 mt-1">
            Here's what's happening in your organization today.
          </p>
        </div>

      </div>

      {/* ── Stats cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEmployees ?? 0}</div>
            <p className="text-xs text-gray-600">
              {stats?.activeEmployees ?? 0} active this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Building2 className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.departmentsCount ?? 0}</div>
            <p className="text-xs text-gray-600">Across organization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
            <Calendar className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.pendingLeaves ?? 0}
            </div>
            <p className="text-xs text-gray-600">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.approvedLeavesThisMonth ?? 0}
            </div>
            <p className="text-xs text-gray-600">
              of {stats?.totalLeavesThisMonth ?? 0} leaves approved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Action required banner ─────────────────────────────────────────── */}
      {hasPermission('leave_approve') && stats && stats.pendingLeaves > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              <span>Action Required</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 text-sm">
              You have {stats.pendingLeaves} leave request
              {stats.pendingLeaves > 1 ? 's' : ''} waiting for your approval.
            </p>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => navigate('/leaves')}
            >
              Review Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Main content grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user}</span>{' '}
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">

             

              {hasPermission('leave_approve') && (
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate('/leaves')}
                >
                  <Calendar className="h-4 w-4 mr-3" />
                  Review Leave Requests
                  {stats && stats.pendingLeaves > 0 && (
                    <span className="ml-auto bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                      {stats.pendingLeaves}
                    </span>
                  )}
                </Button>
              )}

            

              {hasPermission('view_record') && (
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate('/employees')}
                >
                  <TrendingUp className="h-4 w-4 mr-3" />
                  View Employee Directory
                </Button>
              )}

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}