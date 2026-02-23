import LeaveRequest from '../models/LeaveRequest.models.js';

export const getMyAttendance = async (req, res) => {
  try {
    const year      = parseInt(req.query.year) || new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);           // Jan 1
    const yearEnd   = new Date(year, 11, 31, 23, 59, 59, 999); // Dec 31

    const leaves = await LeaveRequest.find({
      employeeId: req.user.id,
      orgId:      req.user.orgId,                     // tenant isolation
      status:     'approved',
      $or: [
        { 'dates.startDate': { $gte: yearStart, $lte: yearEnd } },
        { 'dates.endDate':   { $gte: yearStart, $lte: yearEnd } },
        // leave that spans across the year boundary
        {
          'dates.startDate': { $lte: yearStart },
          'dates.endDate':   { $gte: yearEnd   },
        },
      ],
    }).select('type dates');

    return res.status(200).json(leaves);

  } catch (err) {
    console.error('getMyAttendance error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch attendance report' });
  }
};

// get the organization stats 
export const getOrganizationLeaveStats = async (req, res) => {
  try {
    // ── RBAC ────────────────────────────────────────────────────────────────
    const allowedRoles = ['hr_manager', 'super_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — HR Managers and Admins only' });
    }

    const baseMatch = {
      orgId:  req.user.orgId,
      status: 'approved',
    };

    const [leavesByType, leavesByDepartment] = await Promise.all([

      // ── Aggregation 1: Total days grouped by leave type ─────────────────
      LeaveRequest.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id:       '$type',
            totalDays: { $sum: '$dates.totalDays' },
            count:     { $sum: 1 },
          },
        },
        {
          $project: {
            _id:       0,
            type:      '$_id',
            totalDays: 1,
            count:     1,
          },
        },
        { $sort: { type: 1 } },
      ]),

      // ── Aggregation 2: Total days grouped by department (with name) ──────
      LeaveRequest.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id:       '$departmentId',
            totalDays: { $sum: '$dates.totalDays' },
            count:     { $sum: 1 },
          },
        },
        {
          $lookup: {
            from:         'departments',        // MongoDB collection name
            localField:   '_id',
            foreignField: '_id',
            as:           'departmentInfo',
          },
        },
        {
          $project: {
            _id:            0,
            departmentId:   '$_id',
            departmentName: {
              $ifNull: [
                { $arrayElemAt: ['$departmentInfo.name', 0] },
                'Unknown',
              ],
            },
            totalDays: 1,
            count:     1,
          },
        },
        { $sort: { totalDays: -1 } },           // highest first
      ]),
    ]);

    return res.status(200).json({ leavesByType, leavesByDepartment });

  } catch (err) {
    console.error('getOrganizationLeaveStats error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch organization leave stats' });
  }
};