import mongoose     from 'mongoose';
import User         from '../models/User.models.js';
import LeaveRequest from '../models/LeaveRequest.models.js';
import Department   from '../models/Department.models.js';

export const getDashboardStats = async (req, res) => {
  try {
    const orgId      = new mongoose.Types.ObjectId(req.user.orgId);
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo    = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [userResults, leaveResults, departmentsCount] = await Promise.all([
      
      User.aggregate([
        { $match: { orgId, isDeleted: false } },
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  active: { $sum: { $cond: [{ $gte: ["$lastLogin", weekAgo] }, 1, 0] } }
                }
              }
            ],
            activity: [
              { $match: { createdAt: { $gte: weekAgo } } },
              { $sort:  { createdAt: -1 } },
              { $limit: 5 },
              {
                $project: {
                  id:        { $concat: ["employee-", { $toString: "$_id" }] },
                  type:      { $literal: "employee_added" },
                  message:   { $literal: "joined the organization" },
                  timestamp: "$createdAt",
                  user:      { $trim: { input: { $concat: ["$profile.firstName", " ", "$profile.lastName"] } } }
                }
              }
            ]
          }
        }
      ]),

      LeaveRequest.aggregate([
        { $match: { orgId } },
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id: null,
                  pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },                  
                  approvedMonth: { 
                    $sum: { 
                      $cond: [
                        { $and: [{ $eq: ["$status", "approved"] }, { $gte: ["$createdAt", monthStart] }] }, 
                        1, 0
                      ] 
                    } 
                  },
                  totalMonth: { 
                    $sum: { $cond: [{ $gte: ["$createdAt", monthStart] }, 1, 0] } 
                  }
                }
              }
            ],
            activity: [
              { $sort:  { createdAt: -1 } },
              { $limit: 10 },
              {
                $lookup: {
                  from: "users",
                  localField: "employeeId",
                  foreignField: "_id",
                  as: "emp"
                }
              },
              { $unwind: { path: "$emp", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  id: { $concat: ["leave-", { $toString: "$_id" }] },
                  type: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$status", "pending"] },  then: "leave_request" },
                        { case: { $eq: ["$status", "approved"] }, then: "leave_approved" },
                        { case: { $eq: ["$status", "rejected"] }, then: "leave_rejected" }
                      ],
                      default: "leave_request"
                    }
                  },
                  user: { $trim: { input: { $concat: ["$emp.profile.firstName", " ", "$emp.profile.lastName"] } } },
                  timestamp: { $ifNull: ["$workflow.actionedAt", "$createdAt"] },
                  message: {
                    $concat: [
                      { $replaceAll: { input: { $ifNull: ["$type", "leave"] }, find: "_", replacement: " " } },
                      " request ",
                      { $cond: [{ $eq: ["$status", "pending"] }, "submitted", "$status"] }
                    ]
                  }
                }
              }
            ]
          }
        }
      ]),

      Department.countDocuments({ orgId })
    ]);

    const uData = userResults[0];
    const lData = leaveResults[0];

    const recentActivity = [...(uData.activity || []), ...(lData.activity || [])]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);

    return res.status(200).json({
      totalEmployees:          uData.counts[0]?.total         ?? 0,
      activeEmployees:         uData.counts[0]?.active        ?? 0,
      departmentsCount:        departmentsCount               ?? 0,
      pendingLeaves:           lData.counts[0]?.pending       ?? 0,
      approvedLeavesThisMonth: lData.counts[0]?.approvedMonth ?? 0,
      totalLeavesThisMonth:    lData.counts[0]?.totalMonth    ?? 0,
      recentActivity
    });

  } catch (err) {
    console.error('getDashboardStats Error:', err.stack);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};