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