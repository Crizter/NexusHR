import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getEmployees,
  getEmployeeById,
  addEmployee,
} from '../controllers/employeeController.js';

const router = express.Router();

// ─── Apply protect to every route in this file ────────────────────────────────
router.use(protect);

// GET    /api/employees        → list all employees in org
// POST   /api/employees        → add a new employee
// GET    /api/employees/:id    → get single employee
router.route('/')
  .get(getEmployees)
  .post(addEmployee);

router.route('/:id')
  .get(getEmployeeById);

export default router;