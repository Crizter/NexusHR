import express        from 'express';
import { protect }    from '../middleware/authMiddleware.js';
import Department     from '../models/Department.models.js';

const router = express.Router();
router.use(protect);

// GET /api/departments — returns all departments for the org
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find({ orgId: req.user.orgId }).sort({ name: 1 });
    return res.status(200).json(departments);
  } catch (err) {
    console.error('getDepartments error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch departments' });
  }
});

// PATCH /api/departments/:id/payroll-settings
router.patch('/:id/payroll-settings', async (req, res) => {
  try {
    const allowedRoles = ['hr_manager', 'super_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorised.' });
    }

    const { defaultTaxPercentage, healthInsuranceFlatRate, unpaidLeaveDeductionPerDay } = req.body;

    // Validate — all three must be non-negative numbers if provided
    const updates = {};
    if (defaultTaxPercentage        != null) updates['payrollSettings.defaultTaxPercentage']        = Number(defaultTaxPercentage);
    if (healthInsuranceFlatRate     != null) updates['payrollSettings.healthInsuranceFlatRate']     = Number(healthInsuranceFlatRate);
    if (unpaidLeaveDeductionPerDay  != null) updates['payrollSettings.unpaidLeaveDeductionPerDay']  = Number(unpaidLeaveDeductionPerDay);

    if (Object.values(updates).some(v => isNaN(v) || v < 0)) {
      return res.status(400).json({ message: 'All payroll settings must be non-negative numbers.' });
    }

    const dept = await Department.findOneAndUpdate(
      { _id: req.params.id, orgId: req.user.orgId },   // tenant-scoped
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    return res.status(200).json(dept);
  } catch (err) {
    console.error('updateDepartmentPayrollSettings error:', err.message);
    return res.status(500).json({ message: 'Failed to update payroll settings.' });
  }
});

export default router;