import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthRequest, JWTPayload, User } from '../types';
import db from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
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
    // Load tenant mappings for this user to enforce tenant scoping
    const result = await db.query<{ tenant_id: number }>(
      'SELECT tenant_id FROM user_tenants WHERE user_id = $1',
      [userId]
    );
    req.userTenantIds = result.rows.map(r => r.tenant_id);
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
    const result = await db.query<Pick<User, 'is_admin'>>(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.userId]
    );
    const user = result.rows[0];

    if (!user || !user.is_admin) {
      res.status(403).json({ detail: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
}
