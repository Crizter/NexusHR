import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getEmployees,
  getEmployeeById,
  addEmployee,
  deleteEmployee,
} from '../controllers/employeeController.js';

const router = express.Router();
router.use(protect);

router.route('/')
  .get(getEmployees)
  .post(addEmployee);

router.route('/:id')
  .get(getEmployeeById)
  .delete(deleteEmployee);

export default router;