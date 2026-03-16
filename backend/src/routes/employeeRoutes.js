import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getEmployees,
  getEmployeeById,
  getEmployeeDirectory,
  addEmployee,
  deleteEmployee,
  updateUserMonthlyVars,
} from '../controllers/employeeController.js';

const router = express.Router();
router.use(protect);

router.get('/directory',getEmployeeDirectory);
router.route('/')
  .get(getEmployees)
  .post(addEmployee);

router.route('/:id')
  .get(getEmployeeById)
  .delete(deleteEmployee);


// PATCH /api/users/:id/monthly-vars
router.patch('/:id/monthly-vars', updateUserMonthlyVars);

export default router;