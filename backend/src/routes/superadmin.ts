import { Router, Response } from 'express';
import { authMiddleware, hashPassword } from '../middleware/auth.js';
import { superadminMiddleware } from '../middleware/roleMiddleware.js';
import { AuthRequest, User } from '../types/index.js';
import db from '../db/database.js';

const router = Router();

/**
 * POST /api/superadmin/org-admins - Create organization admin
 * Only superadmins can create org admins
 */
router.post('/org-admins', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password, name, organization_id } = req.body;

    if (!email || !password) {
      res.status(400).json({ detail: 'Email and password are required' });
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

    res.status(201).json(result.rows[0]);
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

    const result = await db.query<Omit<User, 'password_hash'>>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, is_active, is_approved, global_role, email_verified, created_by, created_at`,
      values
    );

    res.json(result.rows[0]);
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

    const result = await db.query<Pick<User, 'id' | 'email' | 'is_active'>>(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, email, is_active',
      [id]
    );

    res.json({ message: 'Organization admin deactivated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Deactivate org admin error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
