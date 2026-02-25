import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api"; // ← real API
import type { LeaveRequest, Organization } from "@/lib/api"; // ← real type
import { toast } from "sonner"; // ← toast
import { ApplyLeaveDialog } from "@/components/leaves/ApplyLeaveDialog";
import { PERMISSIONS } from "@/lib/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Check,
  X,
  Clock,
  Calendar,
  Stethoscope,
  Users,
  XCircle,
  Loader2,
} from "lucide-react";

// ─── Status badge helper ──────────────────────────────────────────────────────
function getStatusBadge(status: LeaveRequest["status"]) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-green-100  text-green-800  hover:bg-green-100  border-green-200">
          <Check className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100    text-red-800    hover:bg-red-100    border-red-200">
          <X className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-gray-100   text-gray-600   hover:bg-gray-100   border-gray-200">
          <X className="mr-1 h-3 w-3" />
          Cancelled
        </Badge>
      );
  }
}

// ─── Date formatter ───────────────────────────────────────────────────────────
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateRange(start: Date, end: Date, totalDays: number): string {
  if (totalDays === 1) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function formatLeaveType(type: LeaveRequest["type"]): string {
  return type === "casual_leave" ? "Casual Leave" : "Sick Leave";
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyRows({ cols, message }: { cols: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-900">No leaves found</p>
          <p className="mt-0.5 text-xs text-gray-500">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface BalanceCardProps {
  label: string;
  balance: number;
  total: number;
  icon: React.ReactNode;
  colorClass: string;
}

function BalanceCard({
  label,
  balance,
  total,
  icon,
  colorClass,
}: BalanceCardProps) {
  const used = total - balance;
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-700">
          {label}
        </CardTitle>
        <div className={`rounded-md p-1.5 ${colorClass}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold text-gray-900">{balance}</span>
          <span className="mb-0.5 text-sm text-gray-500">
            / {total} remaining
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100">
          <div
            className={`h-1.5 rounded-full transition-all ${colorClass.includes("blue") ? "bg-blue-500" : "bg-green-500"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">{used} used this year</p>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function LeaveManagement() {
  const { user, hasPermission } = useAuth();

  const canApprove = hasPermission(PERMISSIONS.LEAVE_APPROVE);
  const canApply = hasPermission(PERMISSIONS.APPLY_LEAVE);

  const [personalLeaves, setPersonalLeaves] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState({ casual: 0, sick: 0 });
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState<boolean>(false);
  const [leaveTotals, setLeaveTotals] = useState({casual:0, sick:0}) ; 


  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchLeaves = useCallback(async () => {
    if (!user?.orgId || !user?.id) return;
    try {
      setLoading(true);
      setError(null);
      const orgPromise = api.getOrganization();
      if (canApprove) {
        const [personal, team, employeeProfile, fetchedOrg] = await Promise.all([
          api.getLeaves(user.orgId, user.id),
          api.getLeaves(user.orgId),
          api.getEmployeeById(user.orgId, user.id), // ← fetch live balances
          orgPromise,
        ]);
        setPersonalLeaves(personal);
        setTeamLeaves(team);
        setLeaveBalances(employeeProfile.leaveBalances); // ← set real balances
       setLeaveTotals({
          casual: fetchedOrg.settings.leavePolicy.casualLeaves,
          sick: fetchedOrg.settings.leavePolicy.sickLeaves
        });
      } else {
        const [personal, employeeProfile, fetchedOrg] = await Promise.all([
          api.getLeaves(user.orgId, user.id),
          api.getEmployeeById(user.orgId, user.id), // ← fetch live balances
          orgPromise,
        ]);
        setPersonalLeaves(personal);
        setLeaveBalances(employeeProfile.leaveBalances); // ← set real balances
        setLeaveTotals({
          casual: fetchedOrg.settings.leavePolicy.casualLeaves,
          sick: fetchedOrg.settings.leavePolicy.sickLeaves
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaves");
    } finally {
      setLoading(false);
    }
  }, [user?.orgId, user?.id, canApprove]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // ── Approve / Reject ───────────────────────────────────────────────────────
  const handleStatusUpdate = async (
    leaveId: string,
    status: "approved" | "rejected",
    employeeName: string,
  ) => {
    if (!user?.orgId || !user?.id) return;
    try {
      setActioningId(leaveId);

      
      await api.updateLeaveStatus(
        user.orgId,
        leaveId,
        status,
        user.id,
        status === "approved" ? "Approved by manager" : "Rejected by manager",
      );

      //  Toast feedback
      if (status === "approved") {
        toast.success("Leave approved", {
          description: `${employeeName}'s leave request has been approved.`,
          duration: 4000,
        });
      } else {
        toast.error("Leave rejected", {
          description: `${employeeName}'s leave request has been rejected.`,
          duration: 4000,
        });
      }

      await fetchLeaves();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update leave status";
      toast.error("Action failed", { description: msg, duration: 5000 });
    } finally {
      setActioningId(null);
    }
  };

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={fetchLeaves}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track and manage leave requests across your organization.
          </p>
        </div>
        {canApply && (
          <Button
            className="flex items-center gap-2 shrink-0"
            onClick={() => setApplyDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Request Leave
          </Button>
        )}
      </div>

      {/* Balance cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BalanceCard
          label="Casual Leaves"
          balance={leaveBalances.casual}  
          total={leaveTotals.casual}
          colorClass="bg-blue-100"
          icon={<Calendar className="h-4 w-4 text-blue-600" />}
        />
        <BalanceCard
          label="Sick Leaves"
          balance={leaveBalances.sick}     
          total={leaveTotals.sick}
          colorClass="bg-green-100"
          icon={<Stethoscope className="h-4 w-4 text-green-600" />}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="my-leaves" className="space-y-4">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="my-leaves" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            My Leaves
          </TabsTrigger>
          {canApprove && (
            <TabsTrigger
              value="team-requests"
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Team Requests
              {teamLeaves.filter((l) => l.status === "pending").length > 0 && (
                <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                  {teamLeaves.filter((l) => l.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* My Leaves */}
        <TabsContent value="my-leaves">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-900">
                My Leave History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableHead className="font-semibold text-gray-700">
                        Type
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Dates
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Days
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Reason
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Status
                      </TableHead>
                      <TableHead className="font-semibold text-gray-700">
                        Applied On
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <SkeletonRows cols={6} />
                    ) : personalLeaves.length === 0 ? (
                      <EmptyRows
                        cols={6}
                        message="You haven't applied for any leaves yet."
                      />
                    ) : (
                      personalLeaves.map((leave) => (
                        <TableRow
                          key={leave._id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <TableCell className="font-medium text-sm text-gray-900">
                            {formatLeaveType(leave.type)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                            {formatDateRange(
                              leave.dates.startDate,
                              leave.dates.endDate,
                              leave.dates.totalDays,
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {leave.dates.totalDays}d
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                            {leave.reason}
                          </TableCell>
                          <TableCell>{getStatusBadge(leave.status)}</TableCell>
                          <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(leave.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Requests */}
        {canApprove && (
          <TabsContent value="team-requests">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Team Leave Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">
                          Employee
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          Type
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          Dates
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          Days
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          Reason
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700">
                          Status
                        </TableHead>
                        <TableHead className="font-semibold text-gray-700 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <SkeletonRows cols={7} />
                      ) : teamLeaves.length === 0 ? (
                        <EmptyRows
                          cols={7}
                          message="No leave requests found for your organization."
                        />
                      ) : (
                        teamLeaves.map((leave) => {
                          const isActioning = actioningId === leave._id;
                          return (
                            <TableRow
                              key={leave._id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell className="font-medium text-sm text-gray-900 whitespace-nowrap">
                                {leave.employeeName}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {formatLeaveType(leave.type)}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                                {formatDateRange(
                                  leave.dates.startDate,
                                  leave.dates.endDate,
                                  leave.dates.totalDays,
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {leave.dates.totalDays}d
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 max-w-[180px] truncate">
                                {leave.reason}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(leave.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                {leave.status === "pending" ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isActioning}
                                      onClick={() =>
                                        handleStatusUpdate(
                                          leave._id,
                                          "approved",
                                          leave.employeeName,
                                        )
                                      }
                                      className="h-7 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
                                    >
                                      {isActioning ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="mr-1 h-3.5 w-3.5" />
                                          Approve
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isActioning}
                                      onClick={() =>
                                        handleStatusUpdate(
                                          leave._id,
                                          "rejected",
                                          leave.employeeName,
                                        )
                                      }
                                      className="h-7 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                                    >
                                      {isActioning ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <X className="mr-1 h-3.5 w-3.5" />
                                          Reject
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">
                                    {leave.workflow?.actionedAt
                                      ? formatDate(leave.workflow.actionedAt)
                                      : "—"}
                                  </span>
                                )}
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
          </TabsContent>
        )}
      </Tabs>

      <ApplyLeaveDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        onSuccess={fetchLeaves}
      />
    </div>
  );
}
