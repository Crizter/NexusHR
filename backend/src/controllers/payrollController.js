import Payslip from '../models/Payslip.models.js';
import User    from '../models/User.models.js';
import PayrollBatch from '../models/Payrollbatch.models.js'
import { dispatchPayrollToSQS } from '../services/payrollSqsService.js';
import { dispatchPdfGeneration } from '../services/pdfSqsService.js';
const ALLOWED_ROLES = ['hr_manager', 'super_admin'];


export const generatePayrollDispatcher = async (req,res) => { 
  try {
     if(!ALLOWED_ROLES.includes(req.user.role)){
    return res.status(403).json({ message: 'Forbidden — HR Managers and Admins only' });
  }
  const { month, year } = req.body; 
  const orgId = req.user.orgId ; 
  if (!month || !year) return res.status(400).json({ message: 'month and year are required' });
  // fetch all active employees 
  const employees = await User.find({orgId , isDeleted: false}).select('_id').lean() ; 

  if(employees.length === 0 ){
    return res.status(400).json({ message: "No active employees found to process." });
  }

    const existingBatch = await PayrollBatch.findOne({
      orgId,
      'payPeriod.month': parseInt(month),
      'payPeriod.year':  parseInt(year),
      status: { $in: ['processing', 'completed'] },
    });

    if (existingBatch) {
      return res.status(409).json({
        message: `Payroll for ${month}/${year} is already ${existingBatch.status}.`,
        batchId: existingBatch._id,
      });
    }

  const employeeIds = employees.map((emp) => emp._id.toString());

  // progress bar tracker in mongodb
  const batch = await PayrollBatch.create({
      orgId,
      payPeriod: { month: parseInt(month), year: parseInt(year) },
      totalEmployees: employeeIds.length,
      status: 'processing'
    });

     // ── Dispatch to SQS — THIS is what the worker listens for ────────────────
    // Add console.log here so you can see it fire
    console.log(`[Dispatcher] Sending ${employeeIds.length} employees to SQS for batch ${batch._id}`);

    await dispatchPayrollToSQS(
      batch._id,
      orgId,
      employeeIds,
      Number(year),
      Number(month),
    );

    console.log(`[Dispatcher] SQS dispatch complete for batch ${batch._id}`);

  // send the response for react (instant, while the worker will process in background)
  return res.status(202).json({
    message: "Payroll processing started in the background.",
      batchId: batch._id,
      totalEmployees: employeeIds.length
  });
  } catch (error) {
    console.error("Dispatcher Error:", error);
    return res.status(500).json({ message: "Failed to start payroll generation." });
  }
}


// TODO: ADD THIS IN API.TS
// ─── 2. GET /api/payroll/status/:batchId (THE PROGRESS BAR ROUTE) ──────

export const getPayrollBatchStatus = async(req,res) => { 
  try {
    const batch = await PayrollBatch.findOne({ 
      _id: req.params.batchId, 
      orgId: req.user.orgId // Ensure they only check their own org's batches
    });

    if (!batch) {
      return res.status(404).json({ message: 'Payroll batch not found' });
    }

    return res.status(200).json(batch);

  } catch (error) {
    console.error("Error fetching batch status:", error);
    return res.status(500).json({ message: "Failed to fetch batch status" });
  }
};

// ─── GET /api/payroll ─────────────────────────────────────────────────────────
export const getPayslips = async (req, res) => {
  try {
    const { departmentId, month, year } = req.query;

    if (!departmentId || !month || !year) {
      return res.status(400).json({ message: 'departmentId, month, and year are required' });
    }

    const query = {
      orgId:             req.user.orgId,
      departmentId,
      'payPeriod.month': parseInt(month),
      'payPeriod.year':  parseInt(year),
    };

    // Employees can only see their own payslips
    if (req.user.role === 'employee') {
      query.employeeId = req.user.id;
    }

    const payslips = await Payslip.find(query)
      .populate('employeeId', 'profile.firstName profile.lastName email displayId')
      .sort({ createdAt: -1 })
      .lean();

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

/**
 * GET /api/payroll/my?year=2026
 * Always returns only the authenticated user's own payslips for the full year.
 * Works for every role — fixes href_manager seeing all org payslips in My Profile.
 */
export const getMyPayslips = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ message: 'year query param is required' });
    }

    const payslips = await Payslip.find({
      orgId:            req.user.orgId,
      employeeId:       req.user.id,       // always self-scoped regardless of role
      'payPeriod.year': parseInt(year),
      status:           'paid',            // employees only care about paid slips
    })
      .sort({ 'payPeriod.month': -1 })
      .lean();

    return res.status(200).json(payslips);
  } catch (err) {
    console.error('getMyPayslips error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch payslips' });
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

    // const result = await Payslip.updateMany(
    //   {
    //     orgId:             req.user.orgId,
    //     'payPeriod.month': parseInt(month),
    //     'payPeriod.year':  parseInt(year),
    //     status:            'processed',
    //   },
    //   { $set: { status: 'paid', paymentDate: new Date() } }
    // );

    const queryFilter = {
      orgId: req.user.orgId,
      'payPeriod.year': parseInt(year),
      'payPeriod.month': parseInt(month),
       status: 'processed',
    } ; 

    const paySlipstoPay = await Payslip.find(queryFilter).select('_id').lean() ; 
    if(paySlipstoPay.length === 0 ) { 
       return res.status(400).json({message: `No payslips to process.`});
    }
    // conver objIds to string 
    const payslipIds = paySlipstoPay.map((e) => e._id.toString()) ; 
    // 2. THE UPDATE: Use the exact IDs we just fetched to ensure absolute accuracy
    const result = await Payslip.updateMany(
      { _id: { $in: payslipIds } }, 
      { $set: { status: 'paid', paymentDate: new Date() } }
    );
    // 3. THE SQS DISPATCH: Fire and forget (Notice we don't 'await' it)
    // This allows the Express API to instantly send the 200 OK to React, 
    // while the SQS dispatch happens in the background.
    dispatchPdfGeneration(payslipIds).catch(err => {
      console.error('[SQS] Background dispatch failed:', err.message);
    });

    return res.status(200).json({
      message:       `${result.modifiedCount} payslip(s) marked as paid`,
      modifiedCount: result.modifiedCount,
    });

  } catch (err) {
    console.error('bulkPayPayslips error:', err.message);
    return res.status(500).json({ message: 'Failed to bulk pay payslips' });
  }
};



