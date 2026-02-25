import User         from '../models/User.models.js';
import LeaveRequest from '../models/LeaveRequest.models.js';
import Department   from '../models/Department.models.js';

export const getDashboardStats = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const now   = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const sevenDays  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

    // ── All queries run in parallel — single round trip ───────────────────────
    const [
      totalEmployees,
      activeEmployees,
      departmentsCount,
      pendingLeaves,
      approvedLeavesThisMonth,
      totalLeavesThisMonth,
      recentLeaves,
      newEmployees,
    ] = await Promise.all([

      User.countDocuments({ orgId, isDeleted: false }),

      User.countDocuments({ orgId, isDeleted: false, lastLogin: { $gte: weekAgo, $exists: true } }),

      Department.countDocuments({ orgId }),

      LeaveRequest.countDocuments({ orgId, status: 'pending' }),

      LeaveRequest.countDocuments({
        orgId,
        status:    'approved',
        createdAt: { $gte: monthStart },
      }),

      LeaveRequest.countDocuments({
        orgId,
        createdAt: { $gte: monthStart },
      }),

      // ── Recent leave activity (last 10, newest first) ──────────────────────
      LeaveRequest.find({ orgId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('employeeId', 'profile.firstName profile.lastName')
        .lean(),

      // ── Employees who joined in last 7 days ───────────────────────────────
      User.find({ orgId, createdAt: { $gte: sevenDays } })
        .select('profile.firstName profile.lastName createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // ── Build activity feed on the backend — frontend gets ready-to-render data
    const activity = [];

    recentLeaves.forEach(leave => {
      const firstName = leave.employeeId?.profile?.firstName ?? 'Unknown';
      const lastName  = leave.employeeId?.profile?.lastName  ?? '';
      const name      = `${firstName} ${lastName}`.trim();
      const leaveType = leave.type.replace(/_/g, ' ');

      if (leave.status === 'pending') {
        activity.push({
          id:        `leave-${leave._id}`,
          type:      'leave_request',
          message:   `submitted a ${leaveType} request`,
          timestamp: leave.createdAt,
          user:      name,
        });
      } else if (leave.status === 'approved' || leave.status === 'rejected') {
        activity.push({
          id:        `leave-action-${leave._id}`,
          type:      leave.status === 'approved' ? 'leave_approved' : 'leave_rejected',
          message:   `${leaveType} request was ${leave.status}`,
          timestamp: leave.workflow?.actionedAt ?? leave.updatedAt,
          user:      name,
        });
      }
    });

    newEmployees.forEach(emp => {
      activity.push({
        id:        `employee-${emp._id}`,
        type:      'employee_added',
        message:   'joined the organization',
        timestamp: emp.createdAt,
        user:      `${emp.profile.firstName} ${emp.profile.lastName}`.trim(),
      });
    });

    // Sort all activity newest first, cap at 6
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({
      totalEmployees,
      activeEmployees,
      departmentsCount,
      pendingLeaves,
      approvedLeavesThisMonth,
      totalLeavesThisMonth,
      recentActivity: activity.slice(0, 6),
    });

  } catch (err) {
    console.error('getDashboardStats error:', err.message);
    return res.status(500).json({ message: 'Failed to load dashboard stats' });
  }
};