import crypto       from 'crypto';
import bcrypt       from 'bcryptjs';
import Organization from '../models/Organization.models.js';
import User         from '../models/User.models.js';
import { sendTenantWelcomeEmail } from '../services/emailService.js';

/**
 * POST /api/super-admin/onboard-tenant
 * Creates a new Organisation and its first HR Manager, then emails credentials.
 * Requires: protect + protectSuperAdmin middleware chain.
 */
export const onboardTenant = async (req, res) => {
  try {
    const { orgName, firstName, lastName, email } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!orgName || !firstName || !lastName || !email) {
      return res.status(400).json({
        message: 'orgName, firstName, lastName, and email are all required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── Uniqueness checks ──────────────────────────────────────────────────
    const [existingOrg, existingUser] = await Promise.all([
      Organization.findOne({ name: orgName.trim() }).lean(),
      User.findOne({ email: normalizedEmail }).lean(),
    ]);

    if (existingOrg) {
      return res.status(400).json({
        message: `An organisation named "${orgName}" already exists.`,
      });
    }

    if (existingUser) {
      return res.status(400).json({
        message: `A user with email "${normalizedEmail}" already exists.`,
      });
    }

    // ── Step 1: Create Organisation ────────────────────────────────────────
    const slug = orgName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')        // spaces → hyphens
      .replace(/[^a-z0-9-]/g, ''); // strip non-alphanumeric

    const organization = await Organization.create({ name: orgName.trim(), slug });

    // ── Step 2: Generate temp password ────────────────────────────────────
    const tempPassword  = crypto.randomBytes(5).toString('hex'); // 10 hex chars

    // ── Step 3: Hash password ──────────────────────────────────────────────
    const SALT_ROUNDS   = 12;
    const passwordHash  = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    // ── Step 4: Create HR Manager user ────────────────────────────────────
    const hrUser = await User.create({
      orgId:        organization._id,
      email:        normalizedEmail,
      passwordHash,
      role:         'hr_manager',
      profile: {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
      },
    });

    // ── Step 5: Send welcome email (non-fatal) ────────────────────────────
    try {
      await sendTenantWelcomeEmail({
        hrEmail:      normalizedEmail,
        hrName:       firstName.trim(),
        orgName:      organization.name,
        tempPassword,
        loginUrl:     process.env.CLIENT_URL ?? 'http://localhost:5173',
      });
    } catch (emailErr) {
      // Email failure must NOT roll back tenant creation — log and continue
      console.error('[onboardTenant] Welcome email failed:', emailErr.message);
    }

    return res.status(201).json({
      success: true,
      orgId:   organization._id,
      userId:  hrUser._id,
    });

  } catch (err) {
    // Mongoose duplicate-key (slug race condition or email race)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
      return res.status(400).json({
        message: `Duplicate value for ${field}. The organisation or user may already exist.`,
      });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    console.error('[onboardTenant] Error:', err.message);
    return res.status(500).json({ message: 'Server error during tenant onboarding.' });
  }
};


/**
 * GET /api/super-admin/organizations?limit=10&cursor=<lastId>
 * Cursor-based pagination — sorted _id desc (newest first).
 */
export const getOrganizations = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
    const cursor = req.query.cursor ?? null;

    const filter = cursor
      ? { _id: { $lt: cursor } }   // fetch everything older than the cursor
      : {};

    // Request one extra to probe for a next page
    const docs = await Organization.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

const hasNextPage = docs.length > limit;
    if (hasNextPage) docs.pop(); // remove the probe document

    const nextCursor = hasNextPage ? docs[docs.length - 1]._id : null;

    return res.status(200).json({
      success:    true,
      data:       docs,
      nextCursor: nextCursor ? String(nextCursor) : null,
    });

  } catch (err) {
    console.error('[getOrganizations] Error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch organizations.' });
  }
};



/**
 * PATCH /api/super-admin/organizations/:id
 * Selectively updates an organisation's mutable fields using dot-notation
 * $set so nested objects are never accidentally overwritten.
 */
export const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, subscription, settings } = req.body;

    // Build a flat $set map — only touch fields that were actually sent
    const $set = {};

    if (isActive !== undefined)
      $set.isActive = Boolean(isActive);

    if (subscription?.plan !== undefined)
      $set['subscription.plan'] = subscription.plan;
    if (subscription?.status !== undefined)
      $set['subscription.status'] = subscription.status;
    if (subscription?.maxUsers !== undefined)
      $set['subscription.maxUsers'] = Number(subscription.maxUsers);

    if (settings?.timezone !== undefined)
      $set['settings.timezone'] = settings.timezone;
    if (settings?.payroll?.currency !== undefined)
      $set['settings.payroll.currency'] = settings.payroll.currency;
    if (settings?.payroll?.payCycle !== undefined)
      $set['settings.payroll.payCycle'] = settings.payroll.payCycle;
    if (settings?.payroll?.taxId !== undefined)
      $set['settings.payroll.taxId'] = settings.payroll.taxId;

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    const org = await Organization.findByIdAndUpdate(
      id,
      { $set },
      { new: true, runValidators: true }
    ).lean();

    if (!org) {
      return res.status(404).json({ message: 'Organization not found.' });
    }

    return res.status(200).json({ success: true, data: org });

  } catch (err) {
    if (err.name === 'CastError')
      return res.status(404).json({ message: 'Organization not found.' });
    if (err.name === 'ValidationError')
      return res.status(400).json({ message: err.message });
    console.error('[updateOrganization] Error:', err.message);
    return res.status(500).json({ message: 'Failed to update organization.' });
  }
};
