import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db/database.js';
import { hashPassword, verifyPassword, generateToken, authMiddleware } from '../middleware/auth.js';
import {
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  User,
  AuthRequest
} from '../types/index.js';

const router = Router();

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  skipSuccessfulRequests: true,
  message: { detail: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Register
router.post('/register', async (
  req: Request<{}, {}, RegisterRequest>,
  res: Response
): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ detail: 'Email and password are required' });
      return;
    }

    // Check if user exists
    const existing = await db.query<Pick<User, 'id'>>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      res.status(400).json({ detail: 'Email already registered' });
      return;
    }

    const passwordHash = hashPassword(password);

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Create user
      const userResult = await client.query<Omit<User, 'password_hash' | 'is_approved' | 'is_admin'>>(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, is_active, created_at',
        [email, passwordHash, name || null]
      );
      const createdUser = userResult.rows[0];

      // Create a tenant named "Default" for this user
      const tenantResult = await client.query<{ id: number }>(
        'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
        ['Default']
      );
      const tenantId = tenantResult.rows[0].id;

      // Map user to tenant
      await client.query(
        'INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [createdUser.id, tenantId]
      );

      await client.query('COMMIT');

      res.status(201).json(createdUser);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Login
router.post('/login', loginLimiter, async (
  req: Request<{}, LoginResponse | { detail: string }, LoginRequest>,
  res: Response<LoginResponse | { detail: string }>
): Promise<void> => {
  try {
    // Support both JSON and form-urlencoded
    const email = req.body.username || req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      res.status(400).json({ detail: 'Email and password are required' });
      return;
    }

    // Check for account lockout (5 failed attempts in the last hour)
    const recentFailures = await db.query(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE email = $1 AND success = false
       AND attempted_at > NOW() - INTERVAL '1 hour'`,
      [email]
    );

    if (parseInt(recentFailures.rows[0].count) >= 5) {
      res.status(429).json({
        detail: 'Account temporarily locked due to too many failed attempts. Try again in 1 hour.'
      });
      return;
    }

    const result = await db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      // Log failed login attempt
      await db.query(
        'INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, $3)',
        [email, req.ip, false]
      );

      res.status(401).json({ detail: 'Invalid email or password' });
      return;
    }

    if (!user.is_approved) {
      res.status(403).json({ detail: 'Your account is pending admin approval. Please wait for approval before logging in.' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ detail: 'Your account has been deactivated. Please contact an administrator.' });
      return;
    }

    // Log successful login attempt
    await db.query(
      'INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, $3)',
      [email, req.ip, true]
    );

    const token = generateToken(user.id);

    res.json({
      access_token: token,
      token_type: 'bearer'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Omit<User, 'password_hash'>>(
      `SELECT u.id, u.email, u.name, u.is_active, u.is_admin, u.is_viewer,
              u.global_role, u.email_verified, u.organization_id, u.created_at,
              o.name as organization_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [req.userId]
    );

    const user = result.rows[0];

    if (!user) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    // Get tenant roles
    const tenantRolesResult = await db.query<{ tenant_id: number; role: string; tenant_name: string }>(
      `SELECT ut.tenant_id, ut.role, t.name as tenant_name
       FROM user_tenants ut
       INNER JOIN tenants t ON ut.tenant_id = t.id
       WHERE ut.user_id = $1
       ORDER BY t.name`,
      [req.userId]
    );

    const response = {
      ...user,
      tenant_roles: tenantRolesResult.rows
    };

    res.json(response);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
