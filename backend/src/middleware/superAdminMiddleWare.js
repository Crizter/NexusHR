import jwt        from 'jsonwebtoken';
import SuperAdmin from '../models/SuperAdmin.models.js';

/**
 * Verifies the request carries a valid Super Admin JWT and that the
 * corresponding document exists in the SuperAdmin collection.
 * Rejects any tenant-issued token even if it somehow has role: 'super_admin'.
 */
export const protectSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    // Reject tenant tokens — they will never have a matching SuperAdmin doc,
    // but this short-circuits without an unnecessary DB query.
    if (decoded.role !== 'super_admin') {
      return res.status(403).json({ message: 'Forbidden — Super Admin access required.' });
    }

    // Confirm the admin still exists in the dedicated collection
    const admin = await SuperAdmin.findById(decoded.id).lean();
    if (!admin) {
      return res.status(401).json({ message: 'Super Admin account not found.' });
    }

    req.user = admin;
    next();

  } catch (err) {
    console.error('[protectSuperAdmin] Error:', err.message);
    return res.status(500).json({ message: 'Authentication error.' });
  }
};