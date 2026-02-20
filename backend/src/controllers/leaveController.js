import LeaveRequest from '../models/LeaveRequest.models.js';
import User         from '../models/User.models.js';

// ─── GET /api/leaves ──────────────────────────────────────────────────────────
export const getLeaves = async (req, res) => {
  try {
    // Base query — always scoped to the org (tenant isolation)
    const query = { orgId: req.user.orgId };

    if (req.user.role === 'employee') {
      // Employees can ONLY see their own leaves — non-negotiable
      query.employeeId = req.user.id;

    } else {
      // HR / Admin / Manager — can optionally filter by a specific employee
      if (req.query.employeeId) {
        query.employeeId = req.query.employeeId;
      }

      // Optional status filter (e.g. ?status=pending)
      if (req.query.status) {
        query.status = req.query.status;
      }

      // Optional department filter (e.g. ?departmentId=xxx)
      if (req.query.departmentId) {
        query.departmentId = req.query.departmentId;
      }
    }

    const leaves = await LeaveRequest.find(query)
      .sort({ createdAt: -1 })                  // newest first
      .populate('employeeId',  'profile email displayId')
      .populate('workflow.actionedBy', 'profile email');

    return res.status(200).json(leaves);

  } catch (err) {
    console.error('getLeaves error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch leave requests' });
  }
};

// ─── POST /api/leaves/apply ───────────────────────────────────────────────────
export const applyLeave = async (req, res) => {
  try {
    const { type, dates, reason } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!type || !dates?.startDate || !dates?.endDate || !dates?.totalDays || !reason) {
      return res.status(400).json({
        message: 'type, dates (startDate, endDate, totalDays), and reason are required',
      });
    }

    if (!['casual_leave', 'sick_leave'].includes(type)) {
      return res.status(400).json({
        message: 'type must be casual_leave or sick_leave',
      });
    }

    if (new Date(dates.startDate) > new Date(dates.endDate)) {
      return res.status(400).json({
        message: 'startDate cannot be after endDate',
      });
    }

    // ── Fetch employee to get departmentId + name (denormalized) ─────────
    const employee = await User.findOne({
      _id:       req.user.id,
      orgId:     req.user.orgId,
      isDeleted: false,
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee record not found' });
    }

    // ── Check if employee has enough leave balance ─────────────────────────
    const balanceKey = type === 'casual_leave' ? 'casual' : 'sick';
    if (employee.leaveBalances[balanceKey] < dates.totalDays) {
      return res.status(400).json({
        message: `Insufficient ${balanceKey} leave balance. Available: ${employee.leaveBalances[balanceKey]} day(s)`,
      });
    }

    // ── Create the leave request ──────────────────────────────────────────
    const leave = await LeaveRequest.create({
      orgId:        req.user.orgId,               // ← forced from JWT
      employeeId:   req.user.id,                  // ← forced from JWT
      departmentId: employee.departmentId,
      employeeName: `${employee.profile.firstName} ${employee.profile.lastName}`,
      type,
      status:       'pending',                    // ← always starts as pending
      dates: {
        startDate: new Date(dates.startDate),
        endDate:   new Date(dates.endDate),
        totalDays: dates.totalDays,
      },
      reason,
    });

    return res.status(201).json(leave);

  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    console.error('applyLeave error:', err.message);
    return res.status(500).json({ message: 'Failed to submit leave request' });
  }
};

// ─── PATCH /api/leaves/:id/status ────────────────────────────────────────────
export const updateLeaveStatus = async (req, res) => {
  try {
    const { status, comments } = req.body;

    // ── RBAC — only HR/Admin can approve or reject ────────────────────────
    const allowedRoles = ['hr_manager', 'super_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Forbidden — only HR managers and admins can update leave status',
      });
    }

    // ── Validate status ────────────────────────────────────────────────────
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        message: 'status must be approved or rejected',
      });
    }

    // ── Find leave scoped to org (tenant isolation) ────────────────────────
    const leave = await LeaveRequest.findOne({
      _id:   req.params.id,
      orgId: req.user.orgId,
    });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    // ── Prevent actioning on already-closed requests ──────────────────────
    if (['approved', 'rejected', 'cancelled'].includes(leave.status)) {
      return res.status(400).json({
        message: `Cannot update a leave that is already ${leave.status}`,
      });
    }

    // ── Update status + workflow ──────────────────────────────────────────
    leave.status   = status;
    leave.workflow = {
      actionedBy: req.user.id,
      actionedAt: new Date(),
      comments:   comments ?? '',
    };

    // ── Deduct leave balance if approved ──────────────────────────────────
    if (status === 'approved') {
      const balanceKey = leave.type === 'casual_leave' ? 'casual' : 'sick';

      await User.findByIdAndUpdate(leave.employeeId, {
        $inc: { [`leaveBalances.${balanceKey}`]: -leave.dates.totalDays },
      });
    }

    await leave.save();

    return res.status(200).json(leave);

  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Leave request not found' });
    }
    console.error('updateLeaveStatus error:', err.message);
    return res.status(500).json({ message: 'Failed to update leave status' });
  }
};