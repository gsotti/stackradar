import { Router, Response } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { AuthRequest, Environment } from '../types/index.js';

const router = Router();

interface EnvQueryParams {
  tenant_id?: string;
  site_id?: string;
}

// List environments scoped by tenant/site
router.get('/', authMiddleware, async (
  req: AuthRequest<{}, {}, {}, EnvQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { tenant_id, site_id } = req.query;

    let query = `
      SELECT e.*, si.name as site_name, si.tenant_id, t.name as tenant_name
      FROM environments e
      JOIN sites si ON e.site_id = si.id
      JOIN tenants t ON si.tenant_id = t.id
      WHERE si.tenant_id = ANY($1)
    `;
    const params: any[] = [req.userTenantIds || []];
    let paramIndex = 2;

    if (tenant_id) {
      query += ` AND si.tenant_id = $${paramIndex}`;
      params.push(parseInt(tenant_id));
      paramIndex++;
    }

    if (site_id) {
      query += ` AND e.site_id = $${paramIndex}`;
      params.push(parseInt(site_id));
      paramIndex++;
    }

    query += ' ORDER BY t.name, si.name, e.name ASC';

    const result = await db.query<Environment>(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List environments error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get single environment
router.get('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Environment>(
      `SELECT e.*, si.name as site_name, si.tenant_id, t.name as tenant_name
       FROM environments e
       JOIN sites si ON e.site_id = si.id
       JOIN tenants t ON si.tenant_id = t.id
       WHERE e.id = $1 AND si.tenant_id = ANY($2)`,
      [req.params.id, req.userTenantIds || []]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'Environment not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get environment error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Create environment
router.post('/', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { site_id, name, display_name } = req.body;

    if (!site_id || !name) {
      res.status(400).json({ detail: 'site_id and name are required' });
      return;
    }

    const result = await db.query<Environment>(
      'INSERT INTO environments (site_id, name, display_name) VALUES ($1, $2, $3) RETURNING *',
      [site_id, name, display_name || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create environment error:', error);
    if (error.code === '23505') {
      res.status(409).json({ detail: 'Environment already exists for this site' });
      return;
    }
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Update environment
router.put('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, display_name } = req.body;

    // Build dynamic UPDATE query based on what fields are provided
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      params.push(display_name);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({ detail: 'No fields to update' });
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    const result = await db.query<Environment>(
      `UPDATE environments SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'Environment not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update environment error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Delete environment
router.delete('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Environment>(
      'DELETE FROM environments WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'Environment not found' });
      return;
    }

    res.json({ message: 'Environment deleted' });
  } catch (error) {
    console.error('Delete environment error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
