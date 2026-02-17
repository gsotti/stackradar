import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthRequest, JWTPayload, GlobalRole, TenantRole } from '../types';
import db from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Exiting.');
  process.exit(1);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(userId: number): string {
  // @ts-ignore
    return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): number | null {
  try {
    // @ts-ignore
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded.sub;
  } catch {
    return null;
  }
}

// Express middleware
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  const userId = verifyToken(token);

  if (!userId) {
    res.status(401).json({ detail: 'Invalid or expired token' });
    return;
  }

  req.userId = userId;

  try {
    // Load user's global role, email verification status, and organization
    const userResult = await db.query<{
      global_role: GlobalRole;
      email_verified: boolean;
      organization_id: number | null;
    }>(
      'SELECT global_role, email_verified, organization_id FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];
    if (user) {
      req.globalRole = user.global_role;
      req.emailVerified = user.email_verified;
      req.organizationId = user.organization_id || undefined;
    }

    // Load tenant mappings for this user to enforce tenant scoping
    const tenantResult = await db.query<{ tenant_id: number; role: TenantRole }>(
      'SELECT tenant_id, role FROM user_tenants WHERE user_id = $1',
      [userId]
    );

    req.userTenantIds = tenantResult.rows.map(r => r.tenant_id);

    // Set tenant_role from first tenant (since users have same role across tenants per plan)
    if (tenantResult.rows.length > 0) {
      req.tenantRole = tenantResult.rows[0].role;
    }
  } catch (e) {
    console.error('authMiddleware: failed to load user tenant mappings', e);
    req.userTenantIds = [];
  }

  next();
}

// Admin middleware - requires authentication first
export async function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await db.query<{
      global_role: GlobalRole;
    }>(
      'SELECT global_role FROM users WHERE id = $1',
      [req.userId]
    );
    const user = result.rows[0];

    if (!user) {
      res.status(403).json({ detail: 'Admin access required' });
      return;
    }

    const hasAdminAccess =
      user.global_role === 'superadmin' ||
      user.global_role === 'org_admin';

    if (!hasAdminAccess) {
      res.status(403).json({ detail: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
}

// Editor middleware - blocks viewers from write operations
export async function editorMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Superadmins and org admins can always edit
  if (req.globalRole === 'superadmin' || req.globalRole === 'org_admin') {
    next();
    return;
  }
  // Check tenant role - viewers cannot edit
  if (req.tenantRole === 'viewer') {
    res.status(403).json({ detail: 'Viewers cannot modify data' });
    return;
  }
  next();
}
