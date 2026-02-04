import { Router, Response } from 'express';
import { authMiddleware, editorMiddleware } from '../middleware/auth.js';
import db from '../db/database.js';
import { AuthRequest, System } from '../types/index.js';

const router = Router();

// Get all systems with optional filters
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tenant_id, site_id, environment_id } = req.query;

    let query = `
      SELECT
        sys.*,
        e.name as environment_name,
        e.site_id,
        si.name as site_name,
        si.tenant_id,
        t.name as tenant_name
      FROM systems sys
      JOIN environments e ON sys.environment_id = e.id
      JOIN sites si ON e.site_id = si.id
      JOIN tenants t ON si.tenant_id = t.id
      WHERE si.tenant_id = ANY($1)
    `;
    const params: any[] = [req.userTenantIds || []];
    let paramIndex = 2;

    if (tenant_id) {
      query += ` AND si.tenant_id = $${paramIndex}`;
      params.push(parseInt(tenant_id as string, 10));
      paramIndex++;
    }

    if (site_id) {
      query += ` AND e.site_id = $${paramIndex}`;
      params.push(parseInt(site_id as string, 10));
      paramIndex++;
    }

    if (environment_id) {
      query += ` AND sys.environment_id = $${paramIndex}`;
      params.push(parseInt(environment_id as string, 10));
      paramIndex++;
    }

    query += ' ORDER BY t.name, si.name, e.name, sys.name';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching systems:', error);
    res.status(500).json({ error: 'Failed to fetch systems' });
  }
});

// Get a single system by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await db.query<System>(
      `SELECT
        sys.*,
        e.name as environment_name,
        e.site_id,
        si.name as site_name,
        si.tenant_id,
        t.name as tenant_name
       FROM systems sys
       JOIN environments e ON sys.environment_id = e.id
       JOIN sites si ON e.site_id = si.id
       JOIN tenants t ON si.tenant_id = t.id
       WHERE sys.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'System not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching system:', error);
    res.status(500).json({ error: 'Failed to fetch system' });
  }
});

// Create a new system
router.post('/', authMiddleware, editorMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { environment_id, name, description } = req.body;

    // Validate required fields
    if (!environment_id || !name) {
      res.status(400).json({
        error: 'Missing required fields: environment_id and name are required'
      });
      return;
    }

    // Check if environment exists
    const environmentCheck = await db.query(
      'SELECT id FROM environments WHERE id = $1',
      [environment_id]
    );

    if (environmentCheck.rows.length === 0) {
      res.status(404).json({ error: 'Environment not found' });
      return;
    }

    const result = await db.query<System>(
      `INSERT INTO systems (environment_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [environment_id, name.trim(), description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating system:', error);

    // Handle duplicate system (same environment_id, name)
    if (error.code === '23505') {
      res.status(409).json({
        error: 'A system with this name already exists for this environment'
      });
      return;
    }

    // Handle foreign key violation
    if (error.code === '23503') {
      res.status(404).json({ error: 'Environment not found' });
      return;
    }

    res.status(500).json({ error: 'Failed to create system' });
  }
});

// Update a system
router.put('/:id', authMiddleware, editorMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { environment_id, name, description } = req.body;

    // Validate required fields
    if (!environment_id || !name) {
      res.status(400).json({
        error: 'Missing required fields: environment_id and name are required'
      });
      return;
    }

    const result = await db.query<System>(
      `UPDATE systems
       SET environment_id = $1, name = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [environment_id, name.trim(), description || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'System not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating system:', error);

    // Handle duplicate system
    if (error.code === '23505') {
      res.status(409).json({
        error: 'A system with this name already exists for this environment'
      });
      return;
    }

    // Handle foreign key violation
    if (error.code === '23503') {
      res.status(404).json({ error: 'Environment not found' });
      return;
    }

    res.status(500).json({ error: 'Failed to update system' });
  }
});

// Delete a system
router.delete('/:id', authMiddleware, editorMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query<System>(
      'DELETE FROM systems WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'System not found' });
      return;
    }

    res.json({ message: 'System deleted successfully', system: result.rows[0] });
  } catch (error) {
    console.error('Error deleting system:', error);
    res.status(500).json({ error: 'Failed to delete system' });
  }
});

export default router;
