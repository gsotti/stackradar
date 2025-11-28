import { Router, Request, Response } from 'express';
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

    const result = await db.query<Omit<User, 'password_hash' | 'is_approved' | 'is_admin'>>(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, is_active, created_at',
      [email, passwordHash, name || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Login
router.post('/login', async (
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

    const result = await db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
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
      'SELECT id, email, name, is_active, is_admin, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    const user = result.rows[0];

    if (!user) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
