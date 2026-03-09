import express from 'express' ; 
import passport from 'passport';
import { getPayslipDownloadUrl } from '../controllers/payslipController.js';

const router  = express.Router();

const protect = passport.authenticate('jwt', { session: false });


router.use(protect); 

// GET: /api/payslips/:id/download  - get the 60-second S3 presigned URL
router.get('/:id/download', getPayslipDownloadUrl);

export default router ; 