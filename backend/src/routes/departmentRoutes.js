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

export default router;