import express    from 'express';
import passport   from 'passport';
import {
  updateMyProfile,
  updateMyPassword,
  getProfileUploadUrl,
} from '../controllers/profileController.js';

const router  = express.Router();
const protect = passport.authenticate('jwt', { session: false });

router.use(protect);

// PATCH /api/profile/info      — update name & email
// PATCH /api/profile/password  — change password
router.patch('/info',     updateMyProfile);
router.patch('/password', updateMyPassword);
router.post('/profile-pic-upload-url',getProfileUploadUrl);

export default router;