import express from 'express' ; 
import { protect } from '../middleware/authMiddleware.js';
import { createJobOpening, getPublicJobOpenings,getJobOpenings } from '../controllers/jobController.js';

const router = express.Router() ; 

// PUBLIC ROUTE 
router.get('/public/:orgId', getPublicJobOpenings);

// PROTECTED ROUTES 
router.use(protect) ; 


router.route('/')
    .post(createJobOpening)
    .get(getJobOpenings)
export default router ; 
