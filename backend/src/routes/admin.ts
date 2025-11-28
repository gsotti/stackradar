import { Router, Request, Response } from 'express';
import { cleanupOldLogs } from '../services/cleanup.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { AuthRequest, User } from '../types/index.js';
import db from '../db/database.js';

const router = Router();

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'changeme';

// Manual cleanup endpoint (uses API key)
router.post('/cleanup', (req: Request, res: Response): void => {
  const { admin_key } = req.query;

  if (admin_key !== ADMIN_API_KEY) {
    res.status(401).json({ detail: 'Invalid admin key' });
    return;
  }

  const deleted = cleanupOldLogs();

  res.json({ message: `Deleted ${deleted} old log entries` });
});

// Get all users (admin only)
router.get('/users', authMiddleware, adminMiddleware, async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Omit<User, 'password_hash'>>(`
      SELECT id, email, name, is_active, is_approved, is_admin, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get pending users (admin only)
router.get('/users/pending', authMiddleware, adminMiddleware, async (
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

// Approve user (admin only)
router.post('/users/:id/approve', authMiddleware, adminMiddleware, async (
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

    res.json({ message: 'User approved successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Reject/Delete user (admin only)
router.delete('/users/:id', authMiddleware, adminMiddleware, async (
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

    const result = await db.query<Pick<User, 'email'>>(
      'DELETE FROM users WHERE id = $1 RETURNING email',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    res.json({ message: `User ${result.rows[0].email} deleted successfully` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Deactivate user (admin only)
router.post('/users/:id/deactivate', authMiddleware, adminMiddleware, async (
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

    res.json({ message: 'User deactivated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Activate user (admin only)
router.post('/users/:id/activate', authMiddleware, adminMiddleware, async (
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

// Update user (admin only)
router.put('/users/:id', authMiddleware, adminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, password, is_admin } = req.body;

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
      const { hashPassword } = await import('../middleware/auth.js');
      updates.push(`password_hash = $${paramIndex}`);
      values.push(hashPassword(password));
      paramIndex++;
    }

    if (is_admin !== undefined) {
      updates.push(`is_admin = $${paramIndex}`);
      values.push(is_admin);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({ detail: 'No fields to update' });
      return;
    }

    values.push(id);

    const result = await db.query<Omit<User, 'password_hash'>>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, name, is_active, is_approved, is_admin, created_at`,
      values
    );

    res.json({ message: 'User updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
