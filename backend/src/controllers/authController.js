import jwt    from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User   from '../models/User.models.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Basic input validation ─────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    // ── Find user — explicitly opt-in passwordHash (select: false) ─────────
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .lean(false); // need a Mongoose doc so we can call .save()
    // ── User existence & soft-delete check ────────────────────────────────
    if (!user || user.isDeleted) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // ── Password verification ─────────────────────────────────────────────
    const isMatch =  await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid email or password',  // same message — no enumeration
      });
    }

    // ── Sign JWT ──────────────────────────────────────────────────────────
    const token = jwt.sign(
      {
        id:    user._id,
        orgId: user.orgId,
        role:  user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ── Update lastLogin ──────────────────────────────────────────────────
    user.lastLogin = new Date();
    await user.save();

    // ── Send response ─────────────────────────────────────────────────────
    return res.status(200).json({
      token,
      user: {
        id:    user._id,
        orgId: user.orgId,
        name:  `${user.profile.firstName} ${user.profile.lastName}`,
        email: user.email,
        role:  user.role,
      },
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Server error during login' });
  }
};