import { Response, NextFunction } from 'express';
import { AuthRequest, GlobalRole, TenantRole } from '../types';
import db from '../db/database.js';

/**
 * Middleware that requires the user to be a superadmin.
 * Must be used after authMiddleware.
 */
export async function superadminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ detail: 'Authentication required' });
    return;
  }

  try {
    const result = await db.query<{ global_role: GlobalRole }>(
      'SELECT global_role FROM users WHERE id = $1',
      [req.userId]
    );

    const user = result.rows[0];

    if (!user || user.global_role !== 'superadmin') {
      res.status(403).json({ detail: 'Superadmin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Superadmin middleware error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
}

/**
 * Middleware that requires the user to be an organization admin or superadmin.
 * Must be used after authMiddleware.
 */
export async function orgAdminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ detail: 'Authentication required' });
    return;
  }

  try {
    const result = await db.query<{ global_role: GlobalRole }>(
      'SELECT global_role FROM users WHERE id = $1',
      [req.userId]
    );

    const user = result.rows[0];

    if (!user || (user.global_role !== 'org_admin' && user.global_role !== 'superadmin')) {
      res.status(403).json({ detail: 'Organization admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Org admin middleware error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
}

/**
 * Middleware that requires the user to have tenant_admin role in the target tenant.
 * The tenant ID should be in req.params.id or req.params.tenantId.
 * Must be used after authMiddleware.
 */
export async function tenantAdminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ detail: 'Authentication required' });
    return;
  }

  // Extract tenant ID from params
  const tenantId = req.params.id || req.params.tenantId;

  if (!tenantId) {
    res.status(400).json({ detail: 'Tenant ID not provided' });
    return;
  }

  try {
    // Check if user has global admin role (org_admin or superadmin can manage all tenants)
    const globalRoleResult = await db.query<{ global_role: GlobalRole }>(
      'SELECT global_role FROM users WHERE id = $1',
      [req.userId]
    );

    const user = globalRoleResult.rows[0];

    if (user?.global_role === 'org_admin' || user?.global_role === 'superadmin') {
      next();
      return;
    }

    // Check if user has tenant_admin role in the target tenant
    const result = await db.query<{ role: TenantRole }>(
      'SELECT role FROM user_tenants WHERE user_id = $1 AND tenant_id = $2',
      [req.userId, tenantId]
    );

    const userTenant = result.rows[0];

    if (!userTenant || userTenant.role !== 'tenant_admin') {
      res.status(403).json({ detail: 'Tenant admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Tenant admin middleware error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
}

/**
 * Middleware that requires the user to be a member of the target tenant (any role).
 * The tenant ID should be in req.params.id or req.params.tenantId.
 * Must be used after authMiddleware.
 */
export async function tenantMemberMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ detail: 'Authentication required' });
    return;
  }

  // Extract tenant ID from params
  const tenantId = req.params.id || req.params.tenantId;

  if (!tenantId) {
    res.status(400).json({ detail: 'Tenant ID not provided' });
    return;
  }

  try {
    // Check if user has global admin role (they have access to all tenants)
    const globalRoleResult = await db.query<{ global_role: GlobalRole }>(
      'SELECT global_role FROM users WHERE id = $1',
      [req.userId]
    );

    const user = globalRoleResult.rows[0];

    if (user?.global_role === 'org_admin' || user?.global_role === 'superadmin') {
      next();
      return;
    }

    // Check if user is a member of the target tenant (any role)
    const result = await db.query<{ role: TenantRole }>(
      'SELECT role FROM user_tenants WHERE user_id = $1 AND tenant_id = $2',
      [req.userId, tenantId]
    );

    const userTenant = result.rows[0];

    if (!userTenant) {
      res.status(403).json({ detail: 'Tenant membership required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Tenant member middleware error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
}
