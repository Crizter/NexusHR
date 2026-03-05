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
