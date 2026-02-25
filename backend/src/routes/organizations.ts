import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { superadminMiddleware, orgAdminMiddleware } from '../middleware/roleMiddleware.js';
import db from '../db/database.js';
import { AuthRequest, Organization, User } from '../types/index.js';
import bcrypt from 'bcryptjs';
import { validatePassword } from '../utils/validation.js';
import { logAudit } from '../services/auditLogger.js';

const router = Router();

/**
 * GET /api/organizations - List all organizations
 * SuperAdmin: sees all organizations
 * OrgAdmin: sees only their organization
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let query: string;
    let params: any[];

    if (req.globalRole === 'superadmin') {
      // Superadmin sees all organizations with counts
      query = `
        SELECT o.*,
          COUNT(DISTINCT u.id) FILTER (WHERE u.organization_id = o.id) as user_count,
          COUNT(DISTINCT t.id) FILTER (WHERE t.organization_id = o.id) as tenant_count
        FROM organizations o
        LEFT JOIN users u ON u.organization_id = o.id
        LEFT JOIN tenants t ON t.organization_id = o.id
        GROUP BY o.id
        ORDER BY o.name
      `;
      params = [];
    } else if (req.organizationId) {
      // Org admin sees only their organization
      query = `
        SELECT o.*,
          COUNT(DISTINCT u.id) FILTER (WHERE u.organization_id = o.id) as user_count,
          COUNT(DISTINCT t.id) FILTER (WHERE t.organization_id = o.id) as tenant_count
        FROM organizations o
        LEFT JOIN users u ON u.organization_id = o.id
        LEFT JOIN tenants t ON t.organization_id = o.id
        WHERE o.id = $1
        GROUP BY o.id
      `;
      params = [req.organizationId];
    } else {
      res.json([]);
      return;
    }

    const result = await db.query<Organization>(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('List organizations error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/organizations/:id - Get single organization
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check access
    if (req.globalRole !== 'superadmin' && req.organizationId !== parseInt(id)) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    const result = await db.query<Organization>(
      `SELECT o.*,
        COUNT(DISTINCT u.id) FILTER (WHERE u.organization_id = o.id) as user_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.organization_id = o.id) as tenant_count
       FROM organizations o
       LEFT JOIN users u ON u.organization_id = o.id
       LEFT JOIN tenants t ON t.organization_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'Organization not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/organizations - Create organization (superadmin only)
 */
router.post('/', authMiddleware, superadminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim() === '') {
      res.status(400).json({ detail: 'Organization name is required' });
      return;
    }

    const result = await db.query<Organization>(
      `INSERT INTO organizations (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description || null, req.userId]
    );

    const newOrg = result.rows[0];

    // Create a default tenant for the new organization
    const tenantResult = await db.query(
      `INSERT INTO tenants (name, description, organization_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Default', 'Default tenant', newOrg.id]
    );
    const defaultTenantId = tenantResult.rows[0].id;

    // Associate the creating user with the default tenant
    await db.query(
      'INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2)',
      [req.userId, defaultTenantId]
    );

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: newOrg.id,
      action: 'ORG_CREATE',
      resourceType: 'organization',
      resourceId: newOrg.id,
      newValues: { name: newOrg.name, description: newOrg.description },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json(newOrg);
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/organizations/:id - Update organization
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check access - superadmin or org_admin of this org
    if (req.globalRole !== 'superadmin' && req.organizationId !== parseInt(id)) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    if (!name || name.trim() === '') {
      res.status(400).json({ detail: 'Organization name is required' });
      return;
    }

    // Get current values for audit
    const currentResult = await db.query<Organization>('SELECT * FROM organizations WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      res.status(404).json({ detail: 'Organization not found' });
      return;
    }
    const oldValues = currentResult.rows[0];

    const result = await db.query<Organization>(
      `UPDATE organizations
       SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name.trim(), description || null, id]
    );

    const updatedOrg = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: updatedOrg.id,
      action: 'ORG_UPDATE',
      resourceType: 'organization',
      resourceId: updatedOrg.id,
      oldValues: { name: oldValues.name, description: oldValues.description },
      newValues: { name: updatedOrg.name, description: updatedOrg.description },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(updatedOrg);
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/organizations/:id - Delete organization (superadmin only)
 */
router.delete('/:id', authMiddleware, superadminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get current values for audit
    const currentResult = await db.query<Organization>('SELECT * FROM organizations WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      res.status(404).json({ detail: 'Organization not found' });
      return;
    }
    const org = currentResult.rows[0];

    await db.query('DELETE FROM organizations WHERE id = $1', [id]);

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: parseInt(id),
      action: 'ORG_DELETE',
      resourceType: 'organization',
      resourceId: id,
      oldValues: { name: org.name, description: org.description },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/organizations/:id/users - List users in organization
 */
router.get('/:id/users', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check access
    if (req.globalRole !== 'superadmin' && req.organizationId !== parseInt(id)) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    const result = await db.query<Omit<User, 'password_hash'>>(
      `SELECT id, email, name, is_active, is_approved, global_role, email_verified, organization_id, created_at
       FROM users
       WHERE organization_id = $1
       ORDER BY name NULLS LAST, email`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List org users error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/organizations/:id/users - Create user in organization
 */
router.post('/:id/users', authMiddleware, orgAdminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, name, password } = req.body;

    // Check org access
    if (req.globalRole !== 'superadmin' && req.organizationId !== parseInt(id)) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ detail: 'Email and password are required' });
      return;
    }

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({ detail: passwordCheck.message });
      return;
    }

    // Check email uniqueness
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      res.status(400).json({ detail: 'Email already exists' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.query<Omit<User, 'password_hash'>>(
      `INSERT INTO users (email, name, password_hash, organization_id, is_active, is_approved)
       VALUES ($1, $2, $3, $4, true, true)
       RETURNING id, email, name, is_active, is_approved, global_role, email_verified, organization_id, created_at`,
      [email, name || null, password_hash, id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create org user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/organizations/:id/users/:userId - Edit user in organization
 */
router.put('/:id/users/:userId', authMiddleware, orgAdminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;
    const { name, email, password, is_active } = req.body;

    // Check org access
    if (req.globalRole !== 'superadmin' && req.organizationId !== parseInt(id)) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    // Cannot modify self
    if (parseInt(userId) === req.userId) {
      res.status(400).json({ detail: 'Cannot modify your own account' });
      return;
    }

    // Check user belongs to org
    const userCheck = await db.query<{ global_role: string | null }>(
      'SELECT global_role FROM users WHERE id = $1 AND organization_id = $2',
      [userId, id]
    );

    if (userCheck.rows.length === 0) {
      res.status(404).json({ detail: 'User not found in this organization' });
      return;
    }

    // Cannot modify superadmin or org_admin users
    const userRole = userCheck.rows[0].global_role;
    if (userRole === 'superadmin' || userRole === 'org_admin') {
      res.status(403).json({ detail: 'Cannot modify superadmin or org_admin users' });
      return;
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name || null);
    }

    if (email !== undefined) {
      // Check email uniqueness
      const existingUser = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (existingUser.rows.length > 0) {
        res.status(400).json({ detail: 'Email already exists' });
        return;
      }
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (password !== undefined && password !== '') {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        res.status(400).json({ detail: passwordCheck.message });
        return;
      }
      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(password_hash);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      res.status(400).json({ detail: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await db.query<Omit<User, 'password_hash'>>(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, name, is_active, is_approved, global_role, email_verified, organization_id, created_at`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update org user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/organizations/:id/users/:userId - Delete user from organization
 */
router.delete('/:id/users/:userId', authMiddleware, orgAdminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params;

    // Check org access
    if (req.globalRole !== 'superadmin' && req.organizationId !== parseInt(id)) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    // Cannot delete self
    if (parseInt(userId) === req.userId) {
      res.status(400).json({ detail: 'Cannot delete your own account' });
      return;
    }

    // Check user belongs to org
    const userCheck = await db.query<{ global_role: string | null }>(
      'SELECT global_role FROM users WHERE id = $1 AND organization_id = $2',
      [userId, id]
    );

    if (userCheck.rows.length === 0) {
      res.status(404).json({ detail: 'User not found in this organization' });
      return;
    }

    // Cannot delete superadmin or org_admin users
    const userRole = userCheck.rows[0].global_role;
    if (userRole === 'superadmin' || userRole === 'org_admin') {
      res.status(403).json({ detail: 'Cannot delete superadmin or org_admin users' });
      return;
    }

    // Delete user_tenants entries first
    await db.query('DELETE FROM user_tenants WHERE user_id = $1', [userId]);

    // Delete user
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete org user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/organizations/:id/available-users - List org users NOT in a specific tenant
 * Query param: tenant_id - the tenant to check against
 */
router.get('/:id/available-users', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    // Check access
    if (req.globalRole !== 'superadmin' && req.organizationId !== parseInt(id)) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    if (!tenant_id) {
      res.status(400).json({ detail: 'tenant_id query parameter is required' });
      return;
    }

    const result = await db.query<Omit<User, 'password_hash'>>(
      `SELECT id, email, name, is_active, created_at
       FROM users
       WHERE organization_id = $1
         AND id NOT IN (
           SELECT user_id FROM user_tenants WHERE tenant_id = $2
         )
       ORDER BY name NULLS LAST, email`,
      [id, tenant_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List available org users error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/organizations/:id/users/:userId/set-org-admin - Make user an org admin
 * Superadmin only
 */
router.post('/:id/users/:userId/set-org-admin', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, userId } = req.params;

    // Check org exists
    const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [id]);
    if (orgCheck.rows.length === 0) {
      res.status(404).json({ detail: 'Organization not found' });
      return;
    }

    // Update user
    const result = await db.query<Omit<User, 'password_hash'>>(
      `UPDATE users
       SET global_role = 'org_admin', organization_id = $1
       WHERE id = $2
       RETURNING id, email, name, global_role, organization_id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Set org admin error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/organizations/:id/users/:userId/remove-org-admin - Remove org admin role
 * Superadmin only
 */
router.post('/:id/users/:userId/remove-org-admin', authMiddleware, superadminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, userId } = req.params;

    const result = await db.query<Omit<User, 'password_hash'>>(
      `UPDATE users
       SET global_role = NULL
       WHERE id = $1 AND organization_id = $2 AND global_role = 'org_admin'
       RETURNING id, email, name, global_role, organization_id`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'User not found or not an org admin of this organization' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Remove org admin error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
