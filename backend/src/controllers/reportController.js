import LeaveRequest from "../models/LeaveRequest.models.js";
import mongoose from 'mongoose';

export const getMyAttendance = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    
    const orgId = new mongoose.Types.ObjectId(req.user.orgId);
    const employeeId = new mongoose.Types.ObjectId(req.user.id);

    //  Await the result and separate the stages into their own objects
    const attendance = await LeaveRequest.aggregate([
      {
        $match: {
          orgId: orgId,
          employeeId: employeeId,
          status: "approved",
          "dates.startDate": { $lte: yearEnd }, // Added $
          "dates.endDate": { $gte: yearStart },   // Added $
        }
      },
      {
        $project: {
          _id: 0,
          type: 1,
          start: "$dates.startDate",
          end: "$dates.endDate",
          days: "$dates.totalDays", // Removed the extra comma inside the string
        }
      },
      {
        $sort: { start: 1 }
      }
    ]);

    res.status(200).json(attendance);
  } catch (err) {
    console.error("Scale Error:", err.stack);
    return res.status(500).json({ message: "Error fetching attendance" });
  }
};

export const getOrganizationLeaveStats = async (req, res) => {
  try {
    const allowedRoles = ["hr_manager", "super_admin"];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden — Insufficient permissions" });
    }

    const orgId = new mongoose.Types.ObjectId(req.user.orgId);

    // FIX: Await the result
    const stats = await LeaveRequest.aggregate([
      {
        $match: { orgId: orgId, status: "approved" }, // Status should be string "approved", not 1
      },
      {
        $facet: {
          leavesByType: [
            {
              $group: {
                _id: "$type",
                totalDays: { $sum: "$dates.totalDays" },
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                type: "$_id",
                totalDays: 1,
                count: 1,
              },
            },
            { $sort: { type: 1 } },
          ],
          leavesByDepartment: [
            {
              $group: {
                _id: "$departmentId",
                totalDays: { $sum: "$dates.totalDays" },
                count: { $sum: 1 },
              },
            },
            {
              $lookup: {
                from: "departments",
                localField: "_id",
                foreignField: "_id",
                as: "dept",
              },
            },
            { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                departmentId: "$_id",
                departmentName: { $ifNull: ["$dept.name", "Unknown"] },
                totalDays: 1,
                count: 1,
              },
            },
            { $sort: { totalDays: -1 } },
          ],
        },
      },
    ]);

    // stats is an array, we want the first (and only) item
    const result = stats[0] || { leavesByType: [], leavesByDepartment: [] };
    res.status(200).json(result);
  } catch (err) {
    console.error("getOrganizationLeaveStats Error:", err.stack);
    return res.status(500).json({ message: "Failed to fetch organization stats" });
  }
};