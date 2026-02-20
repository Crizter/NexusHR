import jwt  from 'jsonwebtoken';
import User from '../models/User.models.js';

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // ── Header presence check ─────────────────────────────────────────────
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Not authorised — no token provided',
      });
    }

    // ── Extract token ─────────────────────────────────────────────────────
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'Not authorised — token missing',
      });
    }

    // ── Verify signature & expiry ─────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      const message =
        jwtErr.name === 'TokenExpiredError'
          ? 'Session expired — please log in again'
          : 'Not authorised — invalid token';

      return res.status(401).json({ message });
    }

    // ── Load user from DB (confirms they still exist and aren't deleted) ───
    const user = await User.findById(decoded.id);

    if (!user || user.isDeleted) {
      return res.status(401).json({
        message: 'Not authorised — user no longer exists',
      });
    }

    // ── Attach to request for downstream handlers ─────────────────────────
    req.user = user;

    next();

  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({ message: 'Server error during authentication' });
  }
};