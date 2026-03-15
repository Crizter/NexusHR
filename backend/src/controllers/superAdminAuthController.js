import jwt       from 'jsonwebtoken';
import bcrypt    from 'bcryptjs';
import SuperAdmin from '../models/SuperAdmin.models.js';

/**
 * POST /api/super-admin/login
 * Authenticates against the dedicated SuperAdmin collection — completely
 * isolated from the tenant User collection.
 */
export const superAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // passwordHash is not select:false on SuperAdmin, so no .select() needed
    const admin = await SuperAdmin.findOne({ email: email.toLowerCase().trim() });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },   // role: 'super_admin'
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      success: true,
      token,
      admin: {
        id:    admin._id,
        email: admin.email,
        name:  `${admin.profile.firstName} ${admin.profile.lastName}`,
      },
    });

  } catch (err) {
    console.error('[superAdminLogin] Error:', err.message);
    return res.status(500).json({ message: 'Server error during authentication.' });
  }
};