import express  from 'express';
import passport from 'passport';
import {
  bulkLockPayslips,
  bulkPayPayslips,
  generatePayroll,
  getPayslips,
  updatePayslip,
  updatePayslipStatus,
} from '../controllers/payrollController.js';

const router  = express.Router();
const protect = passport.authenticate('jwt', { session: false });

// All payroll routes require authentication
router.use(protect);

// POST   /api/payroll/generate    — generate payslips for a period (HR/Admin)
// GET    /api/payroll             — list payslips (filtered by role)
// PATCH  /api/payroll/:id         — edit earnings/deductions (HR/Admin, draft only)
// PATCH  /api/payroll/:id/status  — advance status (HR/Admin)
router.patch('/bulk-lock', bulkLockPayslips);
router.patch('/bulk-pay', bulkPayPayslips) ; 
router.post  ('/generate',      generatePayroll);
router.get   ('/',              getPayslips);
router.patch ('/:id/status',    updatePayslipStatus);   // ← must be before /:id
router.patch ('/:id',           updatePayslip);

export default router;