import express    from 'express';
import passport   from 'passport';
import { getMyAttendance, getOrganizationLeaveStats } from '../controllers/reportController.js';
import { getOrgAttendance } from '../controllers/analyticsController.js';
const router  = express.Router();
const protect = passport.authenticate('jwt', { session: false });

// GET /api/reports/attendance?year=2025
router.get('/attendance', protect, getMyAttendance);
router.get('/summary',protect,getOrganizationLeaveStats);


// ─────────────────────────────────────────────────────────────────────────────
// 🏢 HR / ADMIN ROUTES (Only specific roles can access)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/org-attendance', protect, getOrgAttendance);


export default router;