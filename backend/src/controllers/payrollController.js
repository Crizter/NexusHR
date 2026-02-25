import Payslip from '../models/Payslip.models.js';
import User    from '../models/User.models.js';

const ALLOWED_ROLES = ['hr_manager', 'super_admin'];

// ─── POST /api/payroll/generate ───────────────────────────────────────────────
export const generatePayroll = async (req, res) => {
  try {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — HR Managers and Admins only' });
    }

    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    const parsedMonth = parseInt(month);
    const parsedYear  = parseInt(year);

    if (parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json({ message: 'month must be between 1 and 12' });
    }

    // ── Fetch all active employees in the org ──────────────────────────────
    const employees = await User.find({
      orgId:     req.user.orgId,
      isDeleted: false,
    }).select('_id financial profile displayId departmentId');

    if (!employees.length) {
      return res.status(400).json({ message: 'No active employees found in your organisation' });
    }

    // ── Find employees who already have a payslip for this period ──────────
    const existingPayslips = await Payslip.find({
      orgId:              req.user.orgId,
      'payPeriod.month':  parsedMonth,
      'payPeriod.year':   parsedYear,
    }).select('employeeId');

    const alreadyProcessedIds = new Set(
      existingPayslips.map(p => p.employeeId.toString())
    );

    // ── Only generate for employees without a payslip this period ──────────
    const toGenerate = employees.filter(
      emp => !alreadyProcessedIds.has(emp._id.toString())
    );

    if (!toGenerate.length) {
      return res.status(200).json({
        message: 'Payroll already generated for all employees this period',
        generated: 0,
      });
    }

     const payslips = toGenerate.map(emp => {
      const baseSalary = emp.financial?.baseSalary ?? 0;

      return {
        orgId:        req.user.orgId,
        employeeId:   emp._id,
        departmentId: emp.departmentId,
        payPeriod: {
          month: parsedMonth,
          year:  parsedYear,
        },
        earnings: {
          baseSalary,
          bonus:      0,
          allowances: 0,
        },
        deductions: {
          tax:             0,
          healthInsurance: 0,
          unpaidLeave:     0,
        },
        netPay:      baseSalary,   // ← calculate here since insertMany skips pre-save
        status:      'draft',
        paymentDate: null,
      };
    });

    const inserted = await Payslip.insertMany(payslips);

    return res.status(201).json({
      message:   `Payroll generated for ${inserted.length} employee(s)`,
      generated: inserted.length,
      skipped:   alreadyProcessedIds.size,
    });

  } catch (err) {
    console.error('generatePayroll error:', err.message);
    return res.status(500).json({ message: 'Failed to generate payroll' });
  }
};

// ─── GET /api/payroll ─────────────────────────────────────────────────────────
export const getPayslips = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'month and year query params are required' });
    }

    const query = {
      orgId:             req.user.orgId,
      'payPeriod.month': parseInt(month),
      'payPeriod.year':  parseInt(year),
    };

    // ── Employees can only see their own payslips ──────────────────────────
    if (req.user.role === 'employee') {
      query.employeeId = req.user.id;
    }

    const payslips = await Payslip.find(query)
      .populate('employeeId', 'profile.firstName profile.lastName email displayId')
      .sort({ createdAt: -1 });

    return res.status(200).json(payslips);

  } catch (err) {
    console.error('getPayslips error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch payslips' });
  }
};

// ─── PATCH /api/payroll/:id ───────────────────────────────────────────────────
export const updatePayslip = async (req, res) => {
  try {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — HR Managers and Admins only' });
    }

    const payslip = await Payslip.findOne({
      _id:   req.params.id,
      orgId: req.user.orgId,
    });

    if (!payslip) {
      return res.status(404).json({ message: 'Payslip not found' });
    }

    if (payslip.status !== 'draft') {
      return res.status(400).json({
        message: `Cannot edit a payslip with status "${payslip.status}". Only draft payslips can be edited.`,
      });
    }

    const { earnings, deductions } = req.body;

    // ── Use .set() so Mongoose tracks changes to nested paths ─────────────
    if (earnings !== undefined) {
      if (earnings.bonus      !== undefined) payslip.set('earnings.bonus',      earnings.bonus);
      if (earnings.allowances !== undefined) payslip.set('earnings.allowances', earnings.allowances);
    }

    if (deductions !== undefined) {
      if (deductions.tax             !== undefined) payslip.set('deductions.tax',             deductions.tax);
      if (deductions.healthInsurance !== undefined) payslip.set('deductions.healthInsurance', deductions.healthInsurance);
      if (deductions.unpaidLeave     !== undefined) payslip.set('deductions.unpaidLeave',     deductions.unpaidLeave);
    }

    await payslip.save();

    return res.status(200).json(payslip);

  } catch (err) {
    console.error('updatePayslip error:', err.message, err.stack);
    return res.status(500).json({ message: 'Failed to update payslip' });
  }
};

// ─── PATCH /api/payroll/:id/status ───────────────────────────────────────────


export const updatePayslipStatus = async (req, res) => {
  try {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — HR Managers and Admins only' });
    }

    const { status } = req.body;

    const VALID_STATUSES = ['draft', 'processed', 'paid'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const payslip = await Payslip.findOne({
      _id:   req.params.id,
      orgId: req.user.orgId,
    });

    if (!payslip) {
      return res.status(404).json({ message: 'Payslip not found' });
    }

    const STATUS_ORDER = { draft: 0, processed: 1, paid: 2 };
    if (STATUS_ORDER[status] < STATUS_ORDER[payslip.status]) {
      return res.status(400).json({
        message: `Cannot move payslip from "${payslip.status}" back to "${status}"`,
      });
    }

    // ── Use .set() for all field mutations ────────────────────────────────
    payslip.set('status', status);

    if (status === 'paid') {
      payslip.set('paymentDate', new Date());
    }

    await payslip.save();

    return res.status(200).json(payslip);

  } catch (err) {
    console.error('updatePayslipStatus error:', err.message, err.stack);
    return res.status(500).json({ message: 'Failed to update payslip status' });
  }
};



// ─── PATCH /api/payroll/bulk-lock ─────────────────────────────────────────────
export const bulkLockPayslips = async (req, res) => {
  try {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — HR Managers and Admins only' });
    }

    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    const result = await Payslip.updateMany(
      {
        orgId:             req.user.orgId,
        'payPeriod.month': parseInt(month),
        'payPeriod.year':  parseInt(year),
        status:            'draft',
      },
      { $set: { status: 'processed' } }
    );

    return res.status(200).json({
      message:       `${result.modifiedCount} payslip(s) locked successfully`,
      modifiedCount: result.modifiedCount,
    });

  } catch (err) {
    console.error('bulkLockPayslips error:', err.message);
    return res.status(500).json({ message: 'Failed to bulk lock payslips' });
  }
};

// ─── PATCH /api/payroll/bulk-pay ──────────────────────────────────────────────
export const bulkPayPayslips = async (req, res) => {
  try {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — HR Managers and Admins only' });
    }

    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    const result = await Payslip.updateMany(
      {
        orgId:             req.user.orgId,
        'payPeriod.month': parseInt(month),
        'payPeriod.year':  parseInt(year),
        status:            'processed',
      },
      { $set: { status: 'paid', paymentDate: new Date() } }
    );

    return res.status(200).json({
      message:       `${result.modifiedCount} payslip(s) marked as paid`,
      modifiedCount: result.modifiedCount,
    });

  } catch (err) {
    console.error('bulkPayPayslips error:', err.message);
    return res.status(500).json({ message: 'Failed to bulk pay payslips' });
  }
};

