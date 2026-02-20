import { Router, Response } from 'express';
import { authMiddleware, hashPassword } from '../middleware/auth.js';
import { tenantAdminMiddleware, tenantMemberMiddleware } from '../middleware/roleMiddleware.js';
import { AuthRequest, User, TenantRole } from '../types/index.js';
import db from '../db/database.js';
import { validatePassword } from '../utils/validation.js';
import { logAudit } from '../services/auditLogger.js';

const router = Router();

/**
 * GET /api/tenants/:tenantId/available-users - List org users not in this tenant
 * Returns users who share a tenant with the requesting user but are NOT in the specified tenant
 */
router.get('/:tenantId/available-users', authMiddleware, tenantAdminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenantId } = req.params;
    const userTenantIds = req.userTenantIds || [];

    // Get users who are in any of the requesting user's tenants
    // but NOT in the specified tenant
    const result = await db.query<Pick<User, 'id' | 'email' | 'name' | 'is_active' | 'created_at'>>(
      `SELECT DISTINCT u.id, u.email, u.name, u.is_active, u.created_at
       FROM users u
       INNER JOIN user_tenants ut ON u.id = ut.user_id
       WHERE ut.tenant_id = ANY($1)
         AND u.id NOT IN (
           SELECT user_id FROM user_tenants WHERE tenant_id = $2
         )
       ORDER BY u.name NULLS LAST, u.email`,
      [userTenantIds, tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get available users error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/tenants/:tenantId/users/:userId/add - Add existing org user to tenant
 * Requires tenant admin access
 */
router.post('/:tenantId/users/:userId/add', authMiddleware, tenantAdminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenantId, userId } = req.params;
    const { role } = req.body;
    const orgId = req.organizationId;

    const tenantResult = await db.query<{ organization_id: number | null }>(
      'SELECT organization_id FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      res.status(404).json({ detail: 'Tenant not found' });
      return;
    }

    const tenantOrgId = tenantResult.rows[0].organization_id;
    if (!tenantOrgId || (req.globalRole !== 'superadmin' && orgId !== tenantOrgId)) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    // Validate role
    const validRoles: TenantRole[] = ['tenant_admin', 'editor', 'viewer'];
    const userRole: TenantRole = validRoles.includes(role) ? role : 'viewer';

    // Check user exists and belongs to the same organization as the tenant
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
      [userId, tenantOrgId]
    );

    if (userCheck.rows.length === 0) {
      res.status(404).json({ detail: 'User not found in this organization' });
      return;
    }

    // Check user is not already in target tenant
    const existingCheck = await db.query(
      'SELECT user_id FROM user_tenants WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (existingCheck.rows.length > 0) {
      res.status(400).json({ detail: 'User is already a member of this tenant' });
      return;
    }

    // Add user to tenant
    await db.query(
      'INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, $3)',
      [userId, tenantId, userRole]
    );

    // Fetch and return the user info
    const result = await db.query<Omit<User, 'password_hash'> & { role: TenantRole }>(
      `SELECT u.id, u.email, u.name, u.is_active, u.is_approved, u.global_role, u.email_verified, u.created_by, u.created_at,
              ut.role
       FROM users u
       INNER JOIN user_tenants ut ON u.id = ut.user_id
       WHERE u.id = $1 AND ut.tenant_id = $2`,
      [userId, tenantId]
    );

    const addedUser = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: req.organizationId,
      tenantId: parseInt(tenantId),
      action: 'TENANT_USER_ADD',
      resourceType: 'user_tenant',
      resourceId: `${userId}:${tenantId}`,
      newValues: { user_id: userId, tenant_id: tenantId, role: userRole, email: addedUser.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json(addedUser);
  } catch (error) {
    console.error('Add user to tenant error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/tenants/:tenantId/users - List users in tenant
 * Requires tenant admin or member access
 */
router.get('/:tenantId/users', authMiddleware, tenantMemberMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenantId } = req.params;

    const result = await db.query<Omit<User, 'password_hash'> & { role: TenantRole }>(
      `SELECT u.id, u.email, u.name, u.is_active, u.is_approved, u.global_role, u.email_verified, u.created_by, u.created_at,
              ut.role
       FROM users u
       INNER JOIN user_tenants ut ON u.id = ut.user_id
       WHERE ut.tenant_id = $1
       ORDER BY u.created_at DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get tenant users error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/tenants/:tenantId/users - Create/invite user to tenant
 * Requires tenant admin access
 */
router.post('/:tenantId/users', authMiddleware, tenantAdminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenantId } = req.params;
    const { email, password, name, role } = req.body;

    if (!email) {
      res.status(400).json({ detail: 'Email is required' });
      return;
    }

    if (!password) {
      res.status(400).json({ detail: 'Password is required' });
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({ detail: passwordCheck.message });
      return;
    }

    // Validate role
    const validRoles: TenantRole[] = ['tenant_admin', 'editor', 'viewer'];
    if (role && !validRoles.includes(role)) {
      res.status(400).json({ detail: 'Invalid role. Must be tenant_admin, editor, or viewer' });
      return;
    }

    const userRole: TenantRole = role || 'viewer';

    // Check tenant exists and get its organization
    const tenantResult = await db.query<{ id: number; organization_id: number | null }>(
      'SELECT id, organization_id FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      res.status(404).json({ detail: 'Tenant not found' });
      return;
    }

    const tenantOrgId = tenantResult.rows[0].organization_id;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUserResult = await client.query<Pick<User, 'id'>>(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      let userId: number;

      if (existingUserResult.rows.length > 0) {
        // User exists, check if already in tenant
        userId = existingUserResult.rows[0].id;

        const existingMemberResult = await client.query(
          'SELECT user_id FROM user_tenants WHERE user_id = $1 AND tenant_id = $2',
          [userId, tenantId]
        );

        if (existingMemberResult.rows.length > 0) {
          await client.query('ROLLBACK');
          res.status(400).json({ detail: 'User is already a member of this tenant' });
          return;
        }

        // Add existing user to tenant
        await client.query(
          'INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, $3)',
          [userId, tenantId, userRole]
        );
      } else {
        // Create new user with the tenant's organization
        const passwordHash = hashPassword(password);

        const userResult = await client.query<Pick<User, 'id'>>(
          `INSERT INTO users (email, password_hash, name, organization_id, is_active, is_approved, email_verified, created_by)
           VALUES ($1, $2, $3, $4, true, true, true, $5)
           RETURNING id`,
          [email, passwordHash, name || null, tenantOrgId, req.userId]
        );

        userId = userResult.rows[0].id;

        // Add user to tenant
        await client.query(
          'INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, $3)',
          [userId, tenantId, userRole]
        );
      }

      await client.query('COMMIT');

    // Fetch and return the complete user info
    const result = await db.query<Omit<User, 'password_hash'> & { role: TenantRole }>(
      `SELECT u.id, u.email, u.name, u.is_active, u.is_approved, u.global_role, u.email_verified, u.created_by, u.created_at,
              ut.role
       FROM users u
       INNER JOIN user_tenants ut ON u.id = ut.user_id
       WHERE u.id = $1 AND ut.tenant_id = $2`,
      [userId, tenantId]
    );

    const newUser = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: req.organizationId,
      tenantId: parseInt(tenantId),
      action: 'TENANT_USER_CREATE',
      resourceType: 'user_tenant',
      resourceId: `${userId}:${tenantId}`,
      newValues: { user_id: userId, tenant_id: tenantId, role: role || 'viewer', email: newUser.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json(newUser);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create tenant user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * PUT /api/tenants/:tenantId/users/:userId - Update user role in tenant
 * Requires tenant admin access
 */
router.put('/:tenantId/users/:userId', authMiddleware, tenantAdminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenantId, userId } = req.params;
    const { role, name } = req.body;

    // Validate role if provided
    if (role) {
      const validRoles: TenantRole[] = ['tenant_admin', 'editor', 'viewer'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ detail: 'Invalid role. Must be tenant_admin, editor, or viewer' });
        return;
      }
    }

    // Prevent modifying yourself
    if (parseInt(userId) === req.userId) {
      res.status(400).json({ detail: 'Cannot modify your own role' });
      return;
    }

    // Check if user is in tenant
    const existingResult = await db.query<{ role: TenantRole, name: string }>(
      'SELECT ut.role, u.name FROM user_tenants ut JOIN users u ON ut.user_id = u.id WHERE ut.user_id = $1 AND ut.tenant_id = $2',
      [userId, tenantId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'User not found in this tenant' });
      return;
    }
    const oldValues = existingResult.rows[0];

    // Update role in user_tenants if provided
    if (role) {
      await db.query(
        'UPDATE user_tenants SET role = $1 WHERE user_id = $2 AND tenant_id = $3',
        [role, userId, tenantId]
      );
    }

    // Update name in users table if provided
    if (name !== undefined) {
      await db.query(
        'UPDATE users SET name = $1 WHERE id = $2',
        [name, userId]
      );
    }

    // Fetch and return updated user info
    const result = await db.query<Omit<User, 'password_hash'> & { role: TenantRole }>(
      `SELECT u.id, u.email, u.name, u.is_active, u.is_approved, u.global_role, u.email_verified, u.created_by, u.created_at,
              ut.role
       FROM users u
       INNER JOIN user_tenants ut ON u.id = ut.user_id
       WHERE u.id = $1 AND ut.tenant_id = $2`,
      [userId, tenantId]
    );

    const updatedUser = result.rows[0];

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: req.organizationId,
      tenantId: parseInt(tenantId),
      action: 'TENANT_USER_UPDATE',
      resourceType: 'user_tenant',
      resourceId: `${userId}:${tenantId}`,
      oldValues: { role: oldValues.role, name: oldValues.name },
      newValues: { role: updatedUser.role, name: updatedUser.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update tenant user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/tenants/:tenantId/users/:userId - Remove user from tenant
 * Requires tenant admin access
 */
router.delete('/:tenantId/users/:userId', authMiddleware, tenantAdminMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { tenantId, userId } = req.params;

    // Prevent removing yourself
    if (parseInt(userId) === req.userId) {
      res.status(400).json({ detail: 'Cannot remove yourself from the tenant' });
      return;
    }

    // Check if user is in tenant
    const existingResult = await db.query<{ role: TenantRole, email: string }>(
      'SELECT ut.role, u.email FROM user_tenants ut JOIN users u ON ut.user_id = u.id WHERE ut.user_id = $1 AND ut.tenant_id = $2',
      [userId, tenantId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'User not found in this tenant' });
      return;
    }
    const oldValues = existingResult.rows[0];

    // Remove user from tenant
    await db.query(
      'DELETE FROM user_tenants WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    // Log audit
    await logAudit({
      userId: req.userId!,
      organizationId: req.organizationId,
      tenantId: parseInt(tenantId),
      action: 'TENANT_USER_REMOVE',
      resourceType: 'user_tenant',
      resourceId: `${userId}:${tenantId}`,
      oldValues: { user_id: userId, tenant_id: tenantId, role: oldValues.role, email: oldValues.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'User removed from tenant successfully' });
  } catch (error) {
    console.error('Remove tenant user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
