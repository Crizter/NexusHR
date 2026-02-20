import express               from 'express';
import { protect }           from '../middleware/authMiddleware.js';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = express.Router();

// Apply protect to every route in this file
router.use(protect);

// GET /api/dashboard/stats
router.get('/stats', getDashboardStats);

export default router;