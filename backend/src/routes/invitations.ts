import { Router, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { authMiddleware, hashPassword } from '../middleware/auth.js';
import { AuthRequest, Invitation, TenantRole, User } from '../types/index.js';
import db from '../db/database.js';
import { sendEmail } from '../services/alerting/smtp.js';
import { renderTemplate } from '../services/email/templateRenderer.js';
import { validatePassword } from '../utils/validation.js';

const router = Router();

// Rate limiter for token lookup (prevent enumeration)
const tokenLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { detail: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for invitation acceptance
const acceptInvitationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { detail: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const invitationCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 invitations per hour
  message: { detail: 'Too many invitations created. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Generate secure random token for invitation
 */
function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/invitations - Create invitation
 * Requires tenant admin access (validated via body.tenant_id)
 */
router.post('/', authMiddleware, invitationCreateLimiter, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { email, tenant_id, role } = req.body;

    if (!email) {
      res.status(400).json({ detail: 'Email is required' });
      return;
    }

    if (!tenant_id) {
      res.status(400).json({ detail: 'Tenant ID is required' });
      return;
    }

    // Validate role
    const validRoles: TenantRole[] = ['tenant_admin', 'editor', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ detail: 'Invalid role. Must be tenant_admin, editor, or viewer' });
      return;
    }

    // Check if user has permission to invite to this tenant
    const permissionResult = await db.query(
      `SELECT ut.role, u.global_role
       FROM user_tenants ut
       INNER JOIN users u ON u.id = ut.user_id
       WHERE ut.user_id = $1 AND ut.tenant_id = $2`,
      [req.userId, tenant_id]
    );

    const hasGlobalAdmin = await db.query(
      'SELECT global_role FROM users WHERE id = $1 AND global_role IN ($2, $3)',
      [req.userId, 'org_admin', 'superadmin']
    );

    if (permissionResult.rows.length === 0 && hasGlobalAdmin.rows.length === 0) {
      res.status(403).json({ detail: 'You do not have permission to invite users to this tenant' });
      return;
    }

    if (permissionResult.rows.length > 0 && permissionResult.rows[0].role !== 'tenant_admin' && hasGlobalAdmin.rows.length === 0) {
      res.status(403).json({ detail: 'Tenant admin access required' });
      return;
    }

    // Check if tenant exists
    const tenantResult = await db.query(
      'SELECT id, name FROM tenants WHERE id = $1',
      [tenant_id]
    );

    if (tenantResult.rows.length === 0) {
      res.status(404).json({ detail: 'Tenant not found' });
      return;
    }

    const tenantName = tenantResult.rows[0].name;

    // Check if user already exists
    const existingUserResult = await db.query<Pick<User, 'id'>>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUserResult.rows.length > 0) {
      res.status(400).json({ detail: 'User with this email already exists' });
      return;
    }

    // Check if there's already a pending invitation for this email and tenant
    const existingInvitationResult = await db.query<Invitation>(
      'SELECT id FROM invitations WHERE email = $1 AND tenant_id = $2 AND accepted_at IS NULL AND expires_at > NOW()',
      [email, tenant_id]
    );

    if (existingInvitationResult.rows.length > 0) {
      res.status(400).json({ detail: 'Invitation already sent to this email for this tenant' });
      return;
    }

    // Generate invitation token
    const token = generateInvitationToken();

    // Set expiration to 1 week from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const result = await db.query<Invitation>(
      `INSERT INTO invitations (email, token, tenant_id, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [email, token, tenant_id, role, req.userId, expiresAt]
    );

    const invitation = result.rows[0];

    // Send invitation email
    try {
      const invitationUrl = `${process.env.APP_URL || 'http://localhost:5173'}/invitation/${token}`;

      const { html: htmlBody, text: textBody } = renderTemplate('invitation', {
        tenantName,
        role,
        invitationUrl,
        expiresAt: expiresAt.toLocaleDateString(),
      });

      await sendEmail(email, 'You have been invited to StackRadar', htmlBody, textBody);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Continue anyway - invitation is created, user can be manually notified
    }

    res.status(201).json({
      id: invitation.id,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/invitations - List pending invitations
 * Returns invitations created by the current user or for tenants they admin
 */
router.get('/', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Get tenants where user is admin
    const tenantResult = await db.query<{ tenant_id: number }>(
      `SELECT ut.tenant_id
       FROM user_tenants ut
       WHERE ut.user_id = $1 AND ut.role = 'tenant_admin'
       UNION
       SELECT t.id as tenant_id
       FROM tenants t
       INNER JOIN users u ON u.id = $1
       WHERE u.global_role IN ('org_admin', 'superadmin')`,
      [req.userId]
    );

    const tenantIds = tenantResult.rows.map(r => r.tenant_id);

    if (tenantIds.length === 0) {
      res.json([]);
      return;
    }

    const result = await db.query<Invitation & { tenant_name: string; invited_by_name: string }>(
      `SELECT i.*, t.name as tenant_name, u.name as invited_by_name
       FROM invitations i
       INNER JOIN tenants t ON i.tenant_id = t.id
       LEFT JOIN users u ON i.invited_by = u.id
       WHERE i.tenant_id = ANY($1) AND i.accepted_at IS NULL AND i.expires_at > NOW()
       ORDER BY i.created_at DESC`,
      [tenantIds]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * GET /api/invitations/:token - Get invitation details (public)
 */
router.get('/:token', tokenLookupLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `SELECT i.email, i.role, i.expires_at, t.name as tenant_name, u.name as invited_by_name
       FROM invitations i
       JOIN tenants t ON t.id = i.tenant_id
       LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.token = $1 AND i.accepted_at IS NULL`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ detail: 'Invalid or expired invitation' });
      return;
    }

    const invitation = result.rows[0];

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      res.status(404).json({ detail: 'Invalid or expired invitation' });
      return;
    }

    res.json({
      email: invitation.email,
      tenant_name: invitation.tenant_name,
      role: invitation.role,
      invited_by_name: invitation.invited_by_name,
      expires_at: invitation.expires_at
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/invitations/:token/accept - Accept invitation
 * Creates user account and adds them to the tenant
 */
router.post('/:token/accept', acceptInvitationLimiter, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;
    const { password, name } = req.body;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock the invitation row to prevent race conditions
      const invitationResult = await client.query<Invitation>(
        'SELECT * FROM invitations WHERE token = $1 AND accepted_at IS NULL FOR UPDATE',
        [token]
      );

      if (invitationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ detail: 'Invalid or expired invitation' });
        return;
      }

      const invitation = invitationResult.rows[0];

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        res.status(404).json({ detail: 'Invalid or expired invitation' });
        return;
      }

      // Check if user already exists
      const existingUserResult = await client.query<Pick<User, 'id'>>(
        'SELECT id FROM users WHERE email = $1',
        [invitation.email]
      );

      if (existingUserResult.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ detail: 'Invalid or expired invitation' });
        return;
      }

      // Now validate password (only after token is validated)
      if (!password) {
        await client.query('ROLLBACK');
        res.status(400).json({ detail: 'Password is required' });
        return;
      }

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        await client.query('ROLLBACK');
        res.status(400).json({ detail: passwordCheck.message });
        return;
      }

      // Create user
      const passwordHash = hashPassword(password);

      const userResult = await client.query<Pick<User, 'id'>>(
        `INSERT INTO users (email, password_hash, name, is_active, is_approved, email_verified, created_by)
         VALUES ($1, $2, $3, true, true, false, $4)
         RETURNING id`,
        [invitation.email, passwordHash, name || null, invitation.invited_by]
      );

      const userId = userResult.rows[0].id;

      // Add user to tenant with specified role
      await client.query(
        'INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, $3)',
        [userId, invitation.tenant_id, invitation.role]
      );

      // Mark invitation as accepted
      await client.query(
        'UPDATE invitations SET accepted_at = NOW() WHERE id = $1',
        [invitation.id]
      );

      await client.query('COMMIT');

      res.json({ message: 'Invitation accepted successfully', user_id: userId });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * POST /api/invitations/:id/resend - Resend invitation
 * Regenerates token, extends expiry, and resends email
 */
router.post('/:id/resend', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get the invitation by ID
    const invitationResult = await db.query<Invitation>(
      'SELECT * FROM invitations WHERE id = $1',
      [id]
    );

    if (invitationResult.rows.length === 0) {
      res.status(404).json({ detail: 'Invitation not found' });
      return;
    }

    const invitation = invitationResult.rows[0];

    // Cannot resend already accepted invitations
    if (invitation.accepted_at) {
      res.status(400).json({ detail: 'Invitation has already been accepted' });
      return;
    }

    // Check if user has permission (org_admin or tenant_admin for that tenant)
    const permissionResult = await db.query(
      `SELECT ut.role
       FROM user_tenants ut
       WHERE ut.user_id = $1 AND ut.tenant_id = $2`,
      [req.userId, invitation.tenant_id]
    );

    const hasGlobalAdmin = await db.query(
      'SELECT global_role FROM users WHERE id = $1 AND global_role IN ($2, $3)',
      [req.userId, 'org_admin', 'superadmin']
    );

    const canResend =
      (permissionResult.rows.length > 0 && permissionResult.rows[0].role === 'tenant_admin') ||
      hasGlobalAdmin.rows.length > 0;

    if (!canResend) {
      res.status(403).json({ detail: 'You do not have permission to resend this invitation' });
      return;
    }

    // Get tenant name for email
    const tenantResult = await db.query(
      'SELECT name FROM tenants WHERE id = $1',
      [invitation.tenant_id]
    );

    if (tenantResult.rows.length === 0) {
      res.status(404).json({ detail: 'Tenant not found' });
      return;
    }

    const tenantName = tenantResult.rows[0].name;

    // Generate new token
    const newToken = generateInvitationToken();

    // Set new expiration to 1 week from now
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    // Update the invitation record with new token and expires_at
    const updatedResult = await db.query<Invitation>(
      `UPDATE invitations
       SET token = $1, expires_at = $2
       WHERE id = $3
       RETURNING *`,
      [newToken, newExpiresAt, id]
    );

    const updatedInvitation = updatedResult.rows[0];

    // Send the invitation email again
    try {
      const invitationUrl = `${process.env.APP_URL || 'http://localhost:5173'}/invitation/${newToken}`;

      const { html: htmlBody, text: textBody } = renderTemplate('invitation', {
        tenantName,
        role: invitation.role,
        invitationUrl,
        expiresAt: newExpiresAt.toLocaleDateString(),
      });

      await sendEmail(invitation.email, 'You have been invited to StackRadar', htmlBody, textBody);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Return error since the resend action failed
      res.status(500).json({ detail: 'Failed to send invitation email' });
      return;
    }

    res.json({ message: 'Invitation resent successfully', invitation: updatedInvitation });
  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

/**
 * DELETE /api/invitations/:id - Cancel invitation
 * Requires tenant admin access
 */
router.delete('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get invitation details
    const invitationResult = await db.query<Invitation>(
      'SELECT * FROM invitations WHERE id = $1',
      [id]
    );

    if (invitationResult.rows.length === 0) {
      res.status(404).json({ detail: 'Invitation not found' });
      return;
    }

    const invitation = invitationResult.rows[0];

    // Check if user has permission to cancel this invitation
    const permissionResult = await db.query(
      `SELECT ut.role
       FROM user_tenants ut
       WHERE ut.user_id = $1 AND ut.tenant_id = $2`,
      [req.userId, invitation.tenant_id]
    );

    const hasGlobalAdmin = await db.query(
      'SELECT global_role FROM users WHERE id = $1 AND global_role IN ($2, $3)',
      [req.userId, 'org_admin', 'superadmin']
    );

    const canCancel =
      invitation.invited_by === req.userId ||
      (permissionResult.rows.length > 0 && permissionResult.rows[0].role === 'tenant_admin') ||
      hasGlobalAdmin.rows.length > 0;

    if (!canCancel) {
      res.status(403).json({ detail: 'You do not have permission to cancel this invitation' });
      return;
    }

    // Delete invitation
    await db.query('DELETE FROM invitations WHERE id = $1', [id]);

    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
