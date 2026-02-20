import User         from '../models/User.models.js';
import Department   from '../models/Department.models.js';
import LeaveRequest from '../models/LeaveRequest.models.js';

export const getDashboardStats = async (req, res) => {
  try {
    const orgId = req.user.orgId;

    // ── Date helpers ──────────────────────────────────────────────────────────
    const now            = new Date();
    const startOfMonth   = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth     = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const sevenDaysAgo   = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ── Run all 6 queries concurrently ────────────────────────────────────────
    const [
      totalEmployees,
      departmentsCount,
      pendingLeaves,
      approvedLeavesThisMonth,
      totalLeavesThisMonth,
      activeEmployees,
    ] = await Promise.all([

      // 1. Total active employees in org
      User.countDocuments({
        orgId,
        isDeleted: false,
      }),

      // 2. Total departments in org
      Department.countDocuments({ orgId }),

      // 3. Pending leave requests in org
      LeaveRequest.countDocuments({
        orgId,
        status: 'pending',
      }),

      // 4. Approved leaves this calendar month
      LeaveRequest.countDocuments({
        orgId,
        status:    'approved',
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),

      // 5. All leaves this calendar month
      LeaveRequest.countDocuments({
        orgId,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),

      // 6. Employees who logged in within the last 7 days
      User.countDocuments({
        orgId,
        isDeleted:  false,
        lastLogin:  { $gte: sevenDaysAgo },
      }),
    ]);

    return res.status(200).json({
      totalEmployees,
      departmentsCount,
      pendingLeaves,
      approvedLeavesThisMonth,
      totalLeavesThisMonth,
      activeEmployees,
    });

  } catch (err) {
    console.error('getDashboardStats error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
};