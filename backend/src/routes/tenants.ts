import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db/database.js';
import { AuthRequest, Tenant } from '../types/index.js';

const router = Router();

// Get distinct system types from applications table (must be before /:id route)
router.get('/metadata/system-types', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tenant } = req.query;

    let whereClause = '';
    const params: any[] = [];

    if (tenant) {
      whereClause = 'WHERE t.name = $1';
      params.push(tenant);
    }

    const result = await db.query<{ system_type: string }>(
      `SELECT DISTINCT a.system_type
       FROM applications a
       JOIN tenants t ON a.tenant_id = t.id
       ${whereClause}
       ORDER BY a.system_type`,
      params
    );
    res.json(result.rows.map(r => r.system_type));
  } catch (error) {
    console.error('Error fetching system types:', error);
    res.status(500).json({ error: 'Failed to fetch system types' });
  }
});

// Get all tenants
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ids = req.userTenantIds || [];
    if (!ids.length) {
      res.json([]);
      return;
    }

    const result = await db.query<Tenant>(
      'SELECT * FROM tenants WHERE id = ANY($1) ORDER BY name',
      [ids]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get a single tenant by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await db.query<Tenant>(
      'SELECT * FROM tenants WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// Create a new tenant
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      res.status(400).json({ error: 'Tenant name is required' });
      return;
    }

    const result = await db.query<Tenant>(
      `INSERT INTO tenants (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Update a tenant
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      res.status(400).json({ error: 'Tenant name is required' });
      return;
    }

    const result = await db.query<Tenant>(
      `UPDATE tenants
       SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name.trim(), description || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// Delete a tenant
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await db.query<Tenant>(
      'DELETE FROM tenants WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json({ message: 'Tenant deleted successfully', tenant: result.rows[0] });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// Get applications for a specific tenant
router.get('/:id/applications', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT * FROM applications
       WHERE tenant_id = $1
       ORDER BY system_type, environment, name`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tenant applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

export default router;
