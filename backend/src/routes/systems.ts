import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { AuthRequest, System, CreateSystemRequest } from '../types/index.js';

const router = Router();

// Generate secure API token
function generateApiToken(): string {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}

// List user's systems
router.get('/', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<System>(
      'SELECT * FROM systems WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get systems error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get single system
router.get('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<System>(
      'SELECT * FROM systems WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    const system = result.rows[0];

    if (!system) {
      res.status(404).json({ detail: 'System not found' });
      return;
    }

    res.json(system);
  } catch (error) {
    console.error('Get system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Create system
router.post('/', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, retention_days = 30 }: CreateSystemRequest = req.body;

    if (!name) {
      res.status(400).json({ detail: 'Name is required' });
      return;
    }

    const apiToken = generateApiToken();

    const result = await db.query<System>(
      'INSERT INTO systems (name, description, api_token, retention_days, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description || null, apiToken, retention_days, req.userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Update system
router.put('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, retention_days } = req.body;

    const existingResult = await db.query<System>(
      'SELECT * FROM systems WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'System not found' });
      return;
    }

    const result = await db.query<System>(
      `UPDATE systems
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           retention_days = COALESCE($3, retention_days)
       WHERE id = $4
       RETURNING *`,
      [name, description, retention_days, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Delete system
router.delete('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const existingResult = await db.query<System>(
      'SELECT * FROM systems WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'System not found' });
      return;
    }

    await db.query('DELETE FROM systems WHERE id = $1', [req.params.id]);

    res.json({ message: 'System deleted' });
  } catch (error) {
    console.error('Delete system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Regenerate API token
router.post('/:id/regenerate-token', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const existingResult = await db.query<System>(
      'SELECT * FROM systems WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'System not found' });
      return;
    }

    const newToken = generateApiToken();

    const result = await db.query<System>(
      'UPDATE systems SET api_token = $1 WHERE id = $2 RETURNING *',
      [newToken, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Regenerate token error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
