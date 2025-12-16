import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { AuthRequest, System, CreateSystemRequest } from '../types/index.js';

const router = Router();

// Generate secure API token
function generateApiToken(): string {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}

interface SystemQueryParams {
  tenant_id?: string;
}

// List systems (optionally filtered by tenant)
router.get('/', authMiddleware, async (
  req: AuthRequest<{}, {}, {}, SystemQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { tenant_id } = req.query;
    const allowed = req.userTenantIds || [];
    if (!allowed.length) {
      res.json([]);
      return;
    }

    let query = 'SELECT s.*, t.name as tenant_name FROM systems s LEFT JOIN tenants t ON s.tenant_id = t.id WHERE s.tenant_id = ANY($1)';
    const params: any[] = [allowed];

    if (tenant_id) {
      query += ' AND s.tenant_id = $2';
      params.push(tenant_id);
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await db.query<System>(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get systems error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get single system
router.get('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<System>(
      'SELECT s.*, t.name as tenant_name FROM systems s LEFT JOIN tenants t ON s.tenant_id = t.id WHERE s.id = $1 AND s.tenant_id = ANY($2)',
      [req.params.id, req.userTenantIds || []]
    );
    const system = result.rows[0];

    if (!system) {
      res.status(404).json({ detail: 'System not found' });
      return;
    }

    res.json(system);
  } catch (error) {
    console.error('Get system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

interface CreateSystemRequestWithTenant extends CreateSystemRequest {
  tenant_id?: number;
}

// Create system
router.post('/', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, retention_days = 30, tenant_id }: CreateSystemRequestWithTenant = req.body;

    if (!name) {
      res.status(400).json({ detail: 'Name is required' });
      return;
    }

    const apiToken = generateApiToken();

    // Get tenant_id - default to "Default" tenant if not specified
    const tenantResult = await db.query(
      'SELECT id FROM tenants WHERE id = $1 AND id = ANY($2)',
      [tenant_id || 0, req.userTenantIds || []]
    );

    if (tenantResult.rows.length === 0) {
      res.status(400).json({ detail: 'Tenant not found' });
      return;
    }

    const tenantId = tenantResult.rows[0].id;

    const result = await db.query<System>(
      'INSERT INTO systems (name, description, api_token, retention_days, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description || null, apiToken, retention_days, tenantId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Update system
router.put('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, retention_days } = req.body;

    const existingResult = await db.query<System>(
      'SELECT * FROM systems WHERE id = $1',
      [req.params.id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'System not found' });
      return;
    }

    const result = await db.query<System>(
      `UPDATE systems
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           retention_days = COALESCE($3, retention_days)
       WHERE id = $4
       RETURNING *`,
      [name, description, retention_days, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Delete system
router.delete('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const existingResult = await db.query<System>(
      'SELECT * FROM systems WHERE id = $1',
      [req.params.id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'System not found' });
      return;
    }

    await db.query('DELETE FROM systems WHERE id = $1', [req.params.id]);

    res.json({ message: 'System deleted' });
  } catch (error) {
    console.error('Delete system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Regenerate API token
router.post('/:id/regenerate-token', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const existingResult = await db.query<System>(
      'SELECT * FROM systems WHERE id = $1',
      [req.params.id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'System not found' });
      return;
    }

    const newToken = generateApiToken();

    const result = await db.query<System>(
      'UPDATE systems SET api_token = $1 WHERE id = $2 RETURNING *',
      [newToken, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Regenerate token error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get K8s metrics for a system
router.get('/:id/k8s-metrics', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const systemId = req.params.id;

    const result = await db.query(
      'SELECT * FROM k8s_metrics WHERE system_id = $1',
      [systemId]
    );

    if (result.rows.length === 0) {
      res.json(null); // No metrics available for this system yet
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get K8s metrics for system error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Helper to parse step into seconds; supports 1m,5m,15m,1h
function parseStepToSeconds(step?: string): number {
  switch ((step || '1m').toLowerCase()) {
    case '1m': return 60;
    case '5m': return 5 * 60;
    case '15m': return 15 * 60;
    case '1h': return 60 * 60;
    default:
      return 60;
  }
}

// GET /systems/:id/k8s-metrics/history?from&to&step
router.get('/:id/k8s-metrics/history', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const systemId = parseInt(req.params.id);
    const { from, to, step } = req.query as { from?: string; to?: string; step?: string };

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
    const stepSeconds = parseStepToSeconds(step);

    // Compute time bucket using epoch division to support arbitrary minute steps
    const result = await db.query(
      `SELECT 
         to_timestamp(floor(extract(epoch from h.timestamp) / $3) * $3) AS bucket,
         AVG(h.cpu_usage_percent)::float AS cpu_usage_percent,
         AVG(h.memory_usage_percent)::float AS memory_usage_percent
       FROM k8s_metrics_history h
       WHERE h.system_id = $1
         AND h.timestamp >= $2
         AND h.timestamp <= $4
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [systemId, fromDate.toISOString(), stepSeconds, toDate.toISOString()]
    );

    res.json({
      system_id: systemId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      step: stepSeconds,
      points: result.rows.map((r: any) => ({
        timestamp: r.bucket,
        cpu_usage_percent: r.cpu_usage_percent ?? 0,
        memory_usage_percent: r.memory_usage_percent ?? 0
      }))
    });
  } catch (error) {
    console.error('Get K8s metrics history error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /systems/:id/k8s-metrics/live -> last 30 minutes at 1m buckets
router.get('/:id/k8s-metrics/live', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const systemId = parseInt(req.params.id);
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 30 * 60 * 1000);
    const stepSeconds = 60; // 1m

    const result = await db.query(
      `SELECT 
         to_timestamp(floor(extract(epoch from h.timestamp) / $3) * $3) AS bucket,
         AVG(h.cpu_usage_percent)::float AS cpu_usage_percent,
         AVG(h.memory_usage_percent)::float AS memory_usage_percent
       FROM k8s_metrics_history h
       WHERE h.system_id = $1
         AND h.timestamp >= $2
         AND h.timestamp <= $4
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [systemId, fromDate.toISOString(), stepSeconds, toDate.toISOString()]
    );

    res.json({
      system_id: systemId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      step: stepSeconds,
      points: result.rows.map((r: any) => ({
        timestamp: r.bucket,
        cpu_usage_percent: r.cpu_usage_percent ?? 0,
        memory_usage_percent: r.memory_usage_percent ?? 0
      }))
    });
  } catch (error) {
    console.error('Get K8s metrics live error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
