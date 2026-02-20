import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getLeaves,
  applyLeave,
  updateLeaveStatus,
} from '../controllers/leaveController.js';

const router = express.Router();

// Apply protect to every route in this file
router.use(protect);

// GET    /api/leaves              → all leaves (RBAC filtered)
// POST   /api/leaves/apply        → submit a new leave request
// PATCH  /api/leaves/:id/status   → approve or reject a leave
router.get('/',            getLeaves);
router.post('/apply',      applyLeave);
router.patch('/:id/status', updateLeaveStatus);

export default router;