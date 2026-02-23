import express    from 'express';
import passport   from 'passport';
import { getMyAttendance, getOrganizationLeaveStats } from '../controllers/reportController.js';

const router  = express.Router();
const protect = passport.authenticate('jwt', { session: false });

// GET /api/reports/attendance?year=2025
router.get('/attendance', protect, getMyAttendance);
router.get('/summary',protect,getOrganizationLeaveStats);


export default router;