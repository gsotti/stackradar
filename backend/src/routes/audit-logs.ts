import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';
import db from '../db/database.js';

const router = Router();

/**
 * GET /api/audit-logs - Fetch audit logs
 * Superadmin: all logs
 * Org admin: logs for their organization
 */
router.get('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { 
      limit = '50', 
      offset = '0', 
      user_id, 
      resource_type, 
      action,
      start_time,
      end_time
    } = req.query;

    let query = `
      SELECT al.*, u.email as user_email, u.name as user_name, o.name as organization_name, t.name as tenant_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN organizations o ON al.organization_id = o.id
      LEFT JOIN tenants t ON al.tenant_id = t.id
    `;
    const params: any[] = [];
    const whereClauses: string[] = [];

    // Role-based scoping
    if (req.globalRole === 'org_admin' && req.organizationId) {
      whereClauses.push(`al.organization_id = $${params.length + 1}`);
      params.push(req.organizationId);
    } else if (req.globalRole !== 'superadmin') {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    // Filters
    if (user_id) {
      whereClauses.push(`al.user_id = $${params.length + 1}`);
      params.push(user_id);
    }
    if (resource_type) {
      whereClauses.push(`al.resource_type = $${params.length + 1}`);
      params.push(resource_type);
    }
    if (action) {
      whereClauses.push(`al.action = $${params.length + 1}`);
      params.push(action);
    }
    if (start_time) {
      whereClauses.push(`al.timestamp >= $${params.length + 1}`);
      params.push(start_time);
    }
    if (end_time) {
      whereClauses.push(`al.timestamp <= $${params.length + 1}`);
      params.push(end_time);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Pagination
    const totalResult = await db.query(`SELECT COUNT(*) FROM (${query}) as sub`, params);
    const total = parseInt(totalResult.rows[0].count);

    query += ` ORDER BY al.timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await db.query(query, params);

    res.json({
      logs: result.rows,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
