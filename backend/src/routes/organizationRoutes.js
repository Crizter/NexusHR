import express from 'express' ; 
import { getMyOrganization, updateOrganization } from '../controllers/organizationController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router() ; 

router.use(protect);
router.get('/', getMyOrganization);
router.patch('/',updateOrganization) ;


export default router ; 


