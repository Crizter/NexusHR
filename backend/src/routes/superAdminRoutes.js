import express             from 'express';
import { protectSuperAdmin } from '../middleware/superAdminMiddleware.js';
import { superAdminLogin }   from '../controllers/superAdminAuthController.js';
import { onboardTenant, getOrganizations, updateOrganization }     from '../controllers/superAdminController.js';

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/login', superAdminLogin);

// ── Protected — Super Admin JWT only ─────────────────────────────────────────
router.post('/onboard-tenant', protectSuperAdmin, onboardTenant);
router.get('/organizations',    protectSuperAdmin, getOrganizations);
router.patch ('/organizations/:id',    protectSuperAdmin, updateOrganization); 

export default router;