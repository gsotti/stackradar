import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware, hashPassword } from '../middleware/auth.js';
import { superadminMiddleware } from '../middleware/roleMiddleware.js';
import { AuthRequest, User } from '../types/index.js';
import { validatePassword } from '../utils/validation.js';
import db from '../db/database.js';
import { logAudit } from '../services/auditLogger.js';

const router = Router();

// Rate limiter for superadmin user creation
const superadminCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour
  message: { detail: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * POST /api/superadmin/org-admins - Create organization admin
 * Only superadmins can create org admins
 */
router.post('/org-admins', authMiddleware, superadminMiddleware, superadminCreateLimiter, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password, name, organization_id } = req.body;

    if (!email || !password) {
      res.status(400).json({ detail: 'Email and password are required' });
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({ detail: passwordCheck.message });
      return;
    }

    if (!organization_id) {
      res.status(400).json({ detail: 'Organization ID is required' });
      return;
    }

    // Verify organization exists
    const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [organization_id]);
    if (orgCheck.rows.length === 0) {
      res.status(404).json({ detail: 'Organization not found' });
      return;
    }

    // Check if user already exists
    const existingResult = await db.query<Pick<User, 'id'>>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ detail: 'Email already registered' });
      return;
    }

    const passwordHash = hashPassword(password);

    // Create user with org_admin role and organization
    const result = await db.query<Omit<User, 'password_hash'>>(
      `INSERT INTO users (email, password_hash, name, global_role, organization_id, is_active, is_approved, email_verified, created_by)
       VALUES ($1, $2, $3, 'org_admin', $4, true, true, true, $5)
       RETURNING id, email, name, is_active, is_approved, global_role, email_verified, organization_id, created_by, created_at`,
      [email, passwordHash, name || null, organization_id, req.userId]
    );

    const newUser = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: organization_id,
      action: 'ORG_ADMIN_CREATE',
      resourceType: 'user',
      resourceId: newUser.id,
      newValues: { email, name, organization_id, global_role: 'org_admin' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Create org admin error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/superadmin/org-admins - List all organization admins
 * Only superadmins can view all org admins
 */
router.get('/org-admins', authMiddleware, superadminMiddleware, async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Omit<User, 'password_hash'>>(
      `SELECT u.id, u.email, u.name, u.is_active, u.is_approved, u.global_role, u.email_verified, u.created_by, u.created_at,
              creator.name as creator_name
       FROM users u
       LEFT JOIN users creator ON u.created_by = creator.id
       WHERE u.global_role = 'org_admin'
       ORDER BY u.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get org admins error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/superadmin/org-admins/:id - Update organization admin
 * Only superadmins can update org admins
 */
router.put('/org-admins/:id', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, password, is_active } = req.body;

    // Prevent modifying yourself
    if (parseInt(id) === req.userId) {
      res.status(400).json({ detail: 'Cannot modify your own account through this endpoint' });
      return;
    }

    // Check if user exists and is an org_admin
    const existingResult = await db.query<Pick<User, 'id' | 'global_role'>>(
      'SELECT id, global_role FROM users WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    if (existingResult.rows[0].global_role !== 'org_admin') {
      res.status(400).json({ detail: 'User is not an organization admin' });
      return;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name || null);
      paramIndex++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }

    if (password && password.length > 0) {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        res.status(400).json({ detail: passwordCheck.message });
        return;
      }
      updates.push(`password_hash = $${paramIndex}`);
      values.push(hashPassword(password));
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({ detail: 'No fields to update' });
      return;
    }

    values.push(id);

    // Get current values for audit
    const currentResult = await db.query<User>('SELECT * FROM users WHERE id = $1', [id]);
    const oldUser = currentResult.rows[0];

    const result = await db.query<Omit<User, 'password_hash'>>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, is_active, is_approved, global_role, email_verified, created_by, created_at, organization_id`,
      values
    );

    const updatedUser = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: updatedUser.organization_id || undefined,
      action: 'ORG_ADMIN_UPDATE',
      resourceType: 'user',
      resourceId: id,
      oldValues: { name: oldUser.name, email: oldUser.email, is_active: oldUser.is_active },
      newValues: { name: updatedUser.name, email: updatedUser.email, is_active: updatedUser.is_active },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update org admin error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/superadmin/org-admins/:id - Deactivate organization admin
 * Only superadmins can deactivate org admins
 */
router.delete('/org-admins/:id', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent deactivating yourself
    if (parseInt(id) === req.userId) {
      res.status(400).json({ detail: 'Cannot deactivate your own account' });
      return;
    }

    // Check if user exists and is an org_admin
    const existingResult = await db.query<Pick<User, 'id' | 'global_role'>>(
      'SELECT id, global_role FROM users WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    if (existingResult.rows[0].global_role !== 'org_admin') {
      res.status(400).json({ detail: 'User is not an organization admin' });
      return;
    }

    const result = await db.query<Pick<User, 'id' | 'email' | 'is_active' | 'organization_id'>>(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, email, is_active, organization_id',
      [id]
    );

    const deactivatedUser = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: deactivatedUser.organization_id || undefined,
      action: 'ORG_ADMIN_DEACTIVATE',
      resourceType: 'user',
      resourceId: id,
      newValues: { is_active: false },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Organization admin deactivated successfully', user: deactivatedUser });
  } catch (error) {
    console.error('Deactivate org admin error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/superadmin/profile - Get superadmin's own profile
 * Only superadmins can access this endpoint
 */
router.get('/profile', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Omit<User, 'password_hash'>>(
      `SELECT id, email, name, is_active, is_approved, global_role, email_verified, created_at, organization_id
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get superadmin profile error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/superadmin/profile - Update superadmin's own profile
 * Allows superadmin to update their email, name, and password
 */
router.put('/profile', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name || null);
      paramIndex++;
    }

    if (email !== undefined) {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        res.status(400).json({ detail: 'Valid email is required' });
        return;
      }

      // Check if email is already taken by another user
      const emailCheck = await db.query<Pick<User, 'id'>>(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.userId]
      );

      if (emailCheck.rows.length > 0) {
        res.status(400).json({ detail: 'Email already in use by another user' });
        return;
      }

      updates.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }

    if (password && password.length > 0) {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        res.status(400).json({ detail: passwordCheck.message });
        return;
      }
      updates.push(`password_hash = $${paramIndex}`);
      values.push(hashPassword(password));
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({ detail: 'No fields to update' });
      return;
    }

    values.push(req.userId);

    // Get current values for audit
    const currentResult = await db.query<User>('SELECT * FROM users WHERE id = $1', [req.userId]);
    const oldUser = currentResult.rows[0];

    const result = await db.query<Omit<User, 'password_hash'>>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, is_active, is_approved, global_role, email_verified, created_at, organization_id`,
      values
    );

    const updatedUser = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: updatedUser.organization_id || undefined,
      action: 'SUPERADMIN_PROFILE_UPDATE',
      resourceType: 'user',
      resourceId: req.userId!,
      oldValues: { name: oldUser.name, email: oldUser.email },
      newValues: { name: updatedUser.name, email: updatedUser.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update superadmin profile error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/superadmin/settings - Get all system settings
 * Only superadmins can view system settings
 */
router.get('/settings', authMiddleware, superadminMiddleware, async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<{ key: string; value: string }>(
      'SELECT key, value FROM system_settings ORDER BY key'
    );

    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    res.json(settings);
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/superadmin/settings - Upsert system settings
 * Only superadmins can update system settings
 * Body: { key: value, ... }
 */
router.put('/settings', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const updates = req.body as Record<string, string>;

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      res.status(400).json({ detail: 'Request body must be a key-value object' });
      return;
    }

    const entries = Object.entries(updates);
    if (entries.length === 0) {
      res.status(400).json({ detail: 'No settings provided' });
      return;
    }

    for (const [key, value] of entries) {
      if (typeof key !== 'string' || key.trim() === '') {
        res.status(400).json({ detail: 'Setting keys must be non-empty strings' });
        return;
      }
      if (typeof value !== 'string') {
        res.status(400).json({ detail: `Value for key "${key}" must be a string` });
        return;
      }
    }

    // Fetch old values for audit log
    const oldResult = await db.query<{ key: string; value: string }>(
      'SELECT key, value FROM system_settings WHERE key = ANY($1)',
      [entries.map(([k]) => k)]
    );
    const oldValues: Record<string, string> = {};
    for (const row of oldResult.rows) {
      oldValues[row.key] = row.value;
    }

    // Upsert each setting
    for (const [key, value] of entries) {
      await db.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      );
    }

    // Log audit
    await logAudit({
      userId: req.userId!,
      action: 'SYSTEM_SETTINGS_UPDATE',
      resourceType: 'system_settings',
      oldValues,
      newValues: Object.fromEntries(entries),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Return updated settings
    const result = await db.query<{ key: string; value: string }>(
      'SELECT key, value FROM system_settings ORDER BY key'
    );
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    res.json(settings);
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
