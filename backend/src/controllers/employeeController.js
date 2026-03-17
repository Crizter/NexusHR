import bcrypt from "bcryptjs";
import User from "../models/User.models.js";

// ─── GET /api/employees ───────────────────────────────────────────────────────
export const getEmployees = async (req, res) => {
  try {
    const employees = await User.find({
      orgId: req.user.orgId,
      isDeleted: false,
    }).sort({ "profile.firstName": 1 });

    return res.status(200).json(employees);
  } catch (err) {
    console.error("getEmployees error:", err.message);
    return res.status(500).json({ message: "Failed to fetch employees" });
  }
};

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
export const getEmployeeById = async (req, res) => {
  try {
    const employee = await User.findOne({
      _id: req.params.id,
      orgId: req.user.orgId, // ← tenant isolation
      isDeleted: false,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res.status(200).json(employee);
  } catch (err) {
    // Malformed ObjectId throws CastError — return 404 not 500
    if (err.name === "CastError") {
      return res.status(404).json({ message: "Employee not found" });
    }
    console.error("getEmployeeById error:", err.message);
    return res.status(500).json({ message: "Failed to fetch employee" });
  }
};

// ─── POST /api/employees ──────────────────────────────────────────────────────
export const addEmployee = async (req, res) => {
  try {
    const {
      displayId,
      email,
      role,
      departmentId,
      profile,
      financial,
      leaveBalances,
    } = req.body;

    // ── Required field validation ──────────────────────────────────────────
    if (!email || !role || !profile?.firstName || !profile?.lastName) {
      return res.status(400).json({
        message:
          "email, role, profile.firstName and profile.lastName are required",
      });
    }

    // ── Duplicate email check within this org ──────────────────────────────
    const existing = await User.findOne({
      email: email.toLowerCase().trim(),
      orgId: req.user.orgId,
      isDeleted: false,
    });

    if (existing) {
      return res.status(400).json({
        message:
          "An employee with this email already exists in your organisation",
      });
    }

    // ── Hash default password ──────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("password123", 10);

    // ── Create user — orgId is ALWAYS taken from the JWT, never from body ──
    const newEmployee = await User.create({
      orgId: req.user.orgId, // ← forced from token, not req.body
      displayId,
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      departmentId,
      profile,
      financial: financial ?? { baseSalary: 0, currency: "USD" },
      leaveBalances: leaveBalances ?? { casual: 12, sick: 10 },
      isDeleted: false,
    });

    // ── Strip passwordHash before sending back ─────────────────────────────
    const response = newEmployee.toObject();
    delete response.passwordHash;

    return res.status(201).json(response);
  } catch (err) {
    // Mongoose validation errors (enum, required, etc.)
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    // Duplicate key — race condition between the check above and the insert
    if (err.code === 11000) {
      return res.status(400).json({
        message:
          "An employee with this email already exists in your organisation",
      });
    }
    console.error("addEmployee error:", err.message);
    return res.status(500).json({ message: "Failed to create employee" });
  }
};

// ─── DELETE /api/employees/:id  (soft delete) ──────────────────────────────
export const deleteEmployee = async (req, res) => {
  try {
    const employee = await User.findOne({
      _id: req.params.id,
      orgId: req.user.orgId,
      isDeleted: false,
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Prevent self-deletion
    if (employee._id.toString() === req.user.id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account" });
    }

    employee.isDeleted = true;
    await employee.save();

    return res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ message: "Employee not found" });
    }
    console.error("deleteEmployee error:", err.message);
    return res.status(500).json({ message: "Failed to delete employee" });
  }
};


export const updateUserMonthlyVars = async (req, res) => {
  try {

    const allowedRoles = ["hr_manager", "super_admin"] ; 
    const userRole = req.user.role ; 
    if(!allowedRoles.includes(userRole)){
      return res.status(404).json({message: 'Not authenticated'}); 
    }
    const { bonusThisMonth, unpaidLeaveDaysThisMonth } = req.body;

    const user = await User.findOneAndUpdate(
      // Scoped to the HR's org — prevents cross-tenant writes
      { _id: req.params.id, orgId: req.user.orgId },
      {
        $set: {
          'financial.bonusThisMonth':           bonusThisMonth           ?? 0,
          'financial.unpaidLeaveDaysThisMonth': unpaidLeaveDaysThisMonth ?? 0,
        },
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    res.status(200).json({ message: 'Monthly variables updated.' });
  } catch (err) {
    res.status(500).json({ message: err.message ?? 'Failed to update.' });
  }
};


// ─── GET /api/employees/directory ────────────────────────────────────────────
export const getEmployeeDirectory = async (req, res) => {
  try {
    const { cursor, search, departmentId } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    // ── Base query — always scoped to org + active only ───────────────────
    const query = {
      orgId:     req.user.orgId,
      isDeleted: false,
    };

    // ── Optional department filter ────────────────────────────────────────
    if (departmentId) {
      query.departmentId = departmentId;
    }

    // ── Optional search — prefix regex per field ──────────────────────────
    // Anchored ^ regex uses the individual field indexes more efficiently
    // than a full substring scan
  if (search?.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // The ^ forces MongoDB to check the start of the string, unlocking index usage!
      const regex   = new RegExp('^' + escaped, 'i'); 
      query.$or = [
        { 'profile.firstName': regex },
        { 'profile.lastName':  regex },
        { email:               regex },
        { displayId:           regex },
      ];
    }

    // ── Cursor — newest first (_id: -1) ───────────────────────────────────
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const employees = await User.find(query)
      .select('displayId email role departmentId profile.firstName profile.lastName profile.avatarUrl profile.contactNumber')
      .populate('departmentId', 'name')
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasNextPage = employees.length > limit;
    const data        = hasNextPage ? employees.slice(0, limit) : employees;
    const nextCursor  = hasNextPage ? String(data[data.length - 1]._id) : null;

    return res.status(200).json({ data, nextCursor, hasNextPage });

  } catch (err) {
    console.error('getEmployeeDirectory error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch employee directory' });
  }
};