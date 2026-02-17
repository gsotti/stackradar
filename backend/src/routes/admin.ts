import { Router, Response } from 'express';
import { cleanupOldLogs } from '../services/cleanup.js';
import { authMiddleware, hashPassword } from '../middleware/auth.js';
import { superadminMiddleware } from '../middleware/roleMiddleware.js';
import { AuthRequest, User } from '../types/index.js';
import { validatePassword } from '../utils/validation.js';
import db from '../db/database.js';
import { logAudit } from '../services/auditLogger.js';

const router = Router();

// Manual cleanup endpoint (requires superadmin JWT auth)
router.post('/cleanup', authMiddleware, superadminMiddleware, async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const deleted = await cleanupOldLogs();
    res.json({ message: `Deleted ${deleted} old log entries` });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get all users (superadmin only - org admins should use /api/tenants/:id/users)
router.get('/users', authMiddleware, superadminMiddleware, async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Omit<User, 'password_hash'>>(`
      SELECT id, email, name, is_active, is_approved, global_role, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Create user (superadmin only)
router.post('/users', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, password, name, global_role, auto_approve } = req.body;

    if (!email || !password) {
      res.status(400).json({ detail: 'Email and password are required' });
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({ detail: passwordCheck.message });
      return;
    }

    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(400).json({ detail: 'Email already registered' });
      return;
    }

    const passwordHash = hashPassword(password);
    const isApproved = auto_approve !== false; // default to true

    const result = await db.query<Omit<User, 'password_hash'>>(
      `INSERT INTO users (email, password_hash, name, global_role, is_active, is_approved, created_by)
       VALUES ($1, $2, $3, $4, true, $5, $6)
       RETURNING id, email, name, is_active, is_approved, global_role, created_at`,
      [email, passwordHash, name || null, global_role || null, isApproved, req.userId]
    );

    const newUser = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      action: 'USER_CREATE',
      resourceType: 'user',
      resourceId: newUser.id,
      newValues: { email, name, global_role, is_approved: isApproved },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get pending users (superadmin only)
router.get('/users/pending', authMiddleware, superadminMiddleware, async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Pick<User, 'id' | 'email' | 'name' | 'created_at'>>(`
      SELECT id, email, name, created_at
      FROM users
      WHERE is_approved = false AND is_active = true
      ORDER BY created_at ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Approve user (superadmin only)
router.post('/users/:id/approve', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query<Pick<User, 'id' | 'email' | 'name' | 'is_approved'>>(
      'UPDATE users SET is_approved = true WHERE id = $1 RETURNING id, email, name, is_approved',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    // Log audit
    await logAudit({
      userId: req.userId!,
      action: 'USER_APPROVE',
      resourceType: 'user',
      resourceId: id,
      newValues: { is_approved: true },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'User approved successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Reject/Delete user (superadmin only)
router.delete('/users/:id', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.userId) {
      res.status(400).json({ detail: 'Cannot delete your own account' });
      return;
    }

    const result = await db.query<Pick<User, 'email' | 'name'>>(
      'DELETE FROM users WHERE id = $1 RETURNING email, name',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    // Log audit
    await logAudit({
      userId: req.userId!,
      action: 'USER_DELETE',
      resourceType: 'user',
      resourceId: id,
      oldValues: { email: result.rows[0].email, name: result.rows[0].name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: `User ${result.rows[0].email} deleted successfully` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Deactivate user (superadmin only)
router.post('/users/:id/deactivate', authMiddleware, superadminMiddleware, async (
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

    const result = await db.query<Pick<User, 'id' | 'email' | 'is_active'>>(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, email, is_active',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    // Log audit
    await logAudit({
      userId: req.userId!,
      action: 'USER_DEACTIVATE',
      resourceType: 'user',
      resourceId: id,
      newValues: { is_active: false },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'User deactivated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Activate user (superadmin only)
router.post('/users/:id/activate', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query<Pick<User, 'id' | 'email' | 'is_active'>>(
      'UPDATE users SET is_active = true WHERE id = $1 RETURNING id, email, is_active',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    res.json({ message: 'User activated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Update user (superadmin only)
router.put('/users/:id', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, password, global_role } = req.body;

    // Prevent modifying yourself
    if (parseInt(id) === req.userId) {
      res.status(400).json({ detail: 'Cannot modify your own account through this endpoint' });
      return;
    }

    // Check if user exists
    const existingResult = await db.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
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
      const { hashPassword } = await import('../middleware/auth.js');
      updates.push(`password_hash = $${paramIndex}`);
      values.push(hashPassword(password));
      paramIndex++;
    }

    if (global_role !== undefined) {
      updates.push(`global_role = $${paramIndex}`);
      values.push(global_role);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({ detail: 'No fields to update' });
      return;
    }

    values.push(id);

    const result = await db.query<Omit<User, 'password_hash'>>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, is_active, is_approved, global_role, created_at`,
      values
    );

    res.json({ message: 'User updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
