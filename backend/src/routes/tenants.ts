import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { orgAdminMiddleware } from '../middleware/roleMiddleware.js';
import db from '../db/database.js';
import { AuthRequest, Tenant } from '../types/index.js';

const router = Router();

// Get all tenants
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // For org_admin, show all tenants in their organization
    if (req.globalRole === 'org_admin' && req.organizationId) {
      const result = await db.query<Tenant>(
        `SELECT t.*, COUNT(DISTINCT ut.user_id) as user_count
         FROM tenants t
         LEFT JOIN user_tenants ut ON t.id = ut.tenant_id
         WHERE t.organization_id = $1
         GROUP BY t.id
         ORDER BY t.name`,
        [req.organizationId]
      );
      res.json(result.rows);
      return;
    }

    // For regular users, show only their assigned tenants
    const ids = req.userTenantIds || [];
    if (!ids.length) {
      res.json([]);
      return;
    }

    const result = await db.query<Tenant>(
      `SELECT t.*, COUNT(DISTINCT ut.user_id) as user_count
       FROM tenants t
       LEFT JOIN user_tenants ut ON t.id = ut.tenant_id
       WHERE t.id = ANY($1)
       GROUP BY t.id
       ORDER BY t.name`,
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

// Create a new tenant - requires org admin access
router.post('/', authMiddleware, orgAdminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      res.status(400).json({ error: 'Tenant name is required' });
      return;
    }

    const result = await db.query<Tenant>(
      `INSERT INTO tenants (name, description, created_by, organization_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), description || null, req.userId, req.organizationId || null]
    );

    const tenantId = result.rows[0].id;

    // Automatically add the creating org admin to the tenant as tenant_admin
    await db.query(
      'INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.userId, tenantId, 'tenant_admin']
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

// Delete a tenant - requires org admin access
router.delete('/:id', authMiddleware, orgAdminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
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

export default router;
