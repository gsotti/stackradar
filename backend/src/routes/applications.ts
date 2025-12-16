import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db/database.js';
import { AuthRequest, Application } from '../types/index.js';

const router = Router();

// Get all applications with optional filters
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tenant_id, system_id } = req.query;

    let query = `
      SELECT
        a.*,
        s.name as system_name,
        s.tenant_id,
        t.name as tenant_name
      FROM applications a
      JOIN systems s ON a.system_id = s.id
      JOIN tenants t ON s.tenant_id = t.id
      WHERE s.tenant_id = ANY($1)
    `;
    const params: any[] = [req.userTenantIds || []];
    let paramIndex = 2;

    if (tenant_id) {
      query += ` AND s.tenant_id = $${paramIndex}`;
      params.push(tenant_id);
      paramIndex++;
    }

    if (system_id) {
      query += ` AND a.system_id = $${paramIndex}`;
      params.push(system_id);
      paramIndex++;
    }

    query += ' ORDER BY t.name, s.name, a.name';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get a single application by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await db.query<Application>(
      `SELECT
        a.*,
        s.name as system_name,
        s.tenant_id,
        t.name as tenant_name
       FROM applications a
       JOIN systems s ON a.system_id = s.id
       JOIN tenants t ON s.tenant_id = t.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Create a new application
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { system_id, name, description } = req.body;

    // Validate required fields
    if (!system_id || !name) {
      res.status(400).json({
        error: 'Missing required fields: system_id and name are required'
      });
      return;
    }

    // Check if system exists
    const systemCheck = await db.query(
      'SELECT id FROM systems WHERE id = $1',
      [system_id]
    );

    if (systemCheck.rows.length === 0) {
      res.status(404).json({ error: 'System not found' });
      return;
    }

    const result = await db.query<Application>(
      `INSERT INTO applications (system_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [system_id, name.trim(), description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating application:', error);

    // Handle duplicate application (same system_id, name)
    if (error.code === '23505') {
      res.status(409).json({
        error: 'An application with this name already exists for this system'
      });
      return;
    }

    // Handle foreign key violation
    if (error.code === '23503') {
      res.status(404).json({ error: 'System not found' });
      return;
    }

    res.status(500).json({ error: 'Failed to create application' });
  }
});

// Update an application
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { system_id, name, description } = req.body;

    // Validate required fields
    if (!system_id || !name) {
      res.status(400).json({
        error: 'Missing required fields: system_id and name are required'
      });
      return;
    }

    const result = await db.query<Application>(
      `UPDATE applications
       SET system_id = $1, name = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [system_id, name.trim(), description || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating application:', error);

    // Handle duplicate application
    if (error.code === '23505') {
      res.status(409).json({
        error: 'An application with this name already exists for this system'
      });
      return;
    }

    // Handle foreign key violation
    if (error.code === '23503') {
      res.status(404).json({ error: 'System not found' });
      return;
    }

    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Delete an application
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query<Application>(
      'DELETE FROM applications WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    res.json({ message: 'Application deleted successfully', application: result.rows[0] });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
});

export default router;
