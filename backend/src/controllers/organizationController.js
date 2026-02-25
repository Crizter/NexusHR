import mongoose from 'mongoose' ; 
import Organization from '../models/Organization.models.js';

// controller for organization 

// -- GET ORGANIZATION ------------------------------------------

export const getMyOrganization = async (req,res) => { 
    try {
        const organization = await Organization.findById(req.user.orgId);
        if(!organization){
            return res.status(404).json({message:'Organization not found.'});            
        }
        return res.status(200).json(organization);
    } catch (err) {
    // Malformed ObjectId throws CastError — return 404 not 500
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Organization not found.' });
    }
    console.error('getMyOrganization error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch organization.' });
  }
};


export const updateOrganization = async (req, res) => {
  try {
    // ── RBAC guard ──────────────────────────────────────────────────────────
    const { role } = req.user;

    if (role !== 'super_admin' && role !== 'hr_manager') {
      return res.status(403).json({ message: 'Forbidden — insufficient permissions.' });
    }

    // ── Fetch org ────────────────────────────────────────────────────────────
    const organization = await Organization.findById(req.user.orgId);
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found.' });
    }

    const { name, settings, subscription } = req.body;

    // ── super_admin: can update name, settings, subscription (NOT slug) ──────
    if (role === 'super_admin') {
      if (name !== undefined) {
        organization.set('name', name);
      }

      if (settings !== undefined) {
        if (settings.timezone !== undefined) {
          organization.set('settings.timezone', settings.timezone);
        }
        if (settings.leavePolicy !== undefined) {
          if (settings.leavePolicy.casualLeaves !== undefined) {
            organization.set('settings.leavePolicy.casualLeaves', settings.leavePolicy.casualLeaves);
          }
          if (settings.leavePolicy.sickLeaves !== undefined) {
            organization.set('settings.leavePolicy.sickLeaves', settings.leavePolicy.sickLeaves);
          }
        }
        if (settings.payroll !== undefined) {
          if (settings.payroll.currency !== undefined) {
            organization.set('settings.payroll.currency', settings.payroll.currency);
          }
          if (settings.payroll.payCycle !== undefined) {
            organization.set('settings.payroll.payCycle', settings.payroll.payCycle);
          }
          if (settings.payroll.taxId !== undefined) {
            organization.set('settings.payroll.taxId', settings.payroll.taxId);
          }
        }
      }

      if (subscription !== undefined) {
        if (subscription.plan !== undefined) {
          organization.set('subscription.plan', subscription.plan);
        }
        if (subscription.status !== undefined) {
          organization.set('subscription.status', subscription.status);
        }
        if (subscription.maxUsers !== undefined) {
          organization.set('subscription.maxUsers', subscription.maxUsers);
        }
      }
    }

    // ── hr_manager: can update ONLY settings — name & subscription ignored ───
    if (role === 'hr_manager') {
      if (settings !== undefined) {
        if (settings.timezone !== undefined) {
          organization.set('settings.timezone', settings.timezone);
        }
        if (settings.leavePolicy !== undefined) {
          if (settings.leavePolicy.casualLeaves !== undefined) {
            organization.set('settings.leavePolicy.casualLeaves', settings.leavePolicy.casualLeaves);
          }
          if (settings.leavePolicy.sickLeaves !== undefined) {
            organization.set('settings.leavePolicy.sickLeaves', settings.leavePolicy.sickLeaves);
          }
        }
        if (settings.payroll !== undefined) {
          if (settings.payroll.currency !== undefined) {
            organization.set('settings.payroll.currency', settings.payroll.currency);
          }
          if (settings.payroll.payCycle !== undefined) {
            organization.set('settings.payroll.payCycle', settings.payroll.payCycle);
          }
          if (settings.payroll.taxId !== undefined) {
            organization.set('settings.payroll.taxId', settings.payroll.taxId);
          }
        }
      }
      // name and subscription are silently ignored — no error, just not applied
    }

    await organization.save();

    return res.status(200).json(organization);

  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Organization not found.' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    console.error('updateOrganization error:', err.message);
    return res.status(500).json({ message: 'Failed to update organization.' });
  }
};