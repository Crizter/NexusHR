

import mongoose             from 'mongoose';
import ReportAttendanceStat from '../models/analytics/ReportAttendanceStat.models.js';
import MonthlyDepartmentSummary from '../models/analytics/MonthlyDepartmentSummary.models.js';
const ALLOWED_ROLES = ['hr_manager', 'super_admin'];

export const getOrgAttendance = async (req, res) => {
  try {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const orgId = new mongoose.Types.ObjectId(req.user.orgId);
    const year  = parseInt(req.query.year) || new Date().getUTCFullYear();

    const stats = await mongoose.connection
      .collection('report_attendance_stats')
      .find({
        '_id.orgId': orgId,
        '_id.year':  year,      
      })
      .sort({ '_id.date': 1 })
      .toArray();

    console.log(`[getOrgAttendance] found ${stats.length} docs for year=${year}`);
    return res.status(200).json(stats);

  } catch (err) {
    console.error('getOrgAttendance error:', err.message, err.stack);
    return res.status(500).json({ message: 'Failed to fetch org attendance' });
  }
};


export const getDepartmentSalaryBurn = async (req,res) => { 
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const orgId = new mongoose.Types.ObjectId(req.user.orgId);
    const {year} = req.query ; 
    if (!year) {
      return res.status(400).json({ message: 'Year query parameter is required' });
    }

    const reports = await MonthlyDepartmentSummary.find({
      orgId,
      year: parseInt(year),
    }).populate('departmentId','name');

    return res.status(200).json(reports);

}