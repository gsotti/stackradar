import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authMiddleware, editorMiddleware } from '../middleware/auth.js';
import { AuthRequest, Site, CreateSiteRequest } from '../types/index.js';

const router = Router();

// Generate secure API token
function generateApiToken(): string {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}

interface SiteQueryParams {
  tenant_id?: string;
}

// List sites (optionally filtered by tenant)
router.get('/', authMiddleware, async (
  req: AuthRequest<{}, {}, {}, SiteQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { tenant_id } = req.query;
    const allowed = req.userTenantIds || [];
    if (!allowed.length) {
      res.json([]);
      return;
    }

    let query = 'SELECT s.*, t.name as tenant_name FROM sites s LEFT JOIN tenants t ON s.tenant_id = t.id WHERE s.tenant_id = ANY($1)';
    const params: any[] = [allowed];

    if (tenant_id) {
      query += ' AND s.tenant_id = $2';
      params.push(parseInt(tenant_id as string, 10));
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await db.query<Site>(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get single site
router.get('/:id', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await db.query<Site>(
      'SELECT s.*, t.name as tenant_name FROM sites s LEFT JOIN tenants t ON s.tenant_id = t.id WHERE s.id = $1 AND s.tenant_id = ANY($2)',
      [req.params.id, req.userTenantIds || []]
    );
    const site = result.rows[0];

    if (!site) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    res.json(site);
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

interface CreateSiteRequestWithTenant extends CreateSiteRequest {
  tenant_id?: number;
}

// Create site
router.post('/', authMiddleware, editorMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, retention_days = 30, site_type = 'kubernetes', tenant_id }: CreateSiteRequestWithTenant = req.body;

    if (!name) {
      res.status(400).json({ detail: 'Name is required' });
      return;
    }

    // Validate site_type
    const validSiteTypes = ['docker', 'kubernetes', 'generic'];
    if (!validSiteTypes.includes(site_type)) {
      res.status(400).json({ detail: 'Invalid site_type. Must be docker, kubernetes, or generic' });
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

    const result = await db.query<Site>(
      'INSERT INTO sites (name, description, api_token, retention_days, site_type, tenant_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description || null, apiToken, retention_days, site_type, tenantId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Update site
router.put('/:id', authMiddleware, editorMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, retention_days, site_type } = req.body;

    // Validate site_type if provided
    if (site_type) {
      const validSiteTypes = ['docker', 'kubernetes', 'generic'];
      if (!validSiteTypes.includes(site_type)) {
        res.status(400).json({ detail: 'Invalid site_type. Must be docker, kubernetes, or generic' });
        return;
      }
    }

    const existingResult = await db.query<Site>(
      'SELECT * FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [req.params.id, req.userTenantIds || []]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    const result = await db.query<Site>(
      `UPDATE sites
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           retention_days = COALESCE($3, retention_days),
           site_type = COALESCE($4, site_type)
       WHERE id = $5 AND tenant_id = ANY($6)
       RETURNING *`,
      [name, description, retention_days, site_type, req.params.id, req.userTenantIds || []]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Delete site
router.delete('/:id', authMiddleware, editorMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const existingResult = await db.query<Site>(
      'SELECT * FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [req.params.id, req.userTenantIds || []]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    await db.query('DELETE FROM sites WHERE id = $1 AND tenant_id = ANY($2)', [req.params.id, req.userTenantIds || []]);

    res.json({ message: 'Site deleted' });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Regenerate API token
router.post('/:id/regenerate-token', authMiddleware, editorMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const existingResult = await db.query<Site>(
      'SELECT * FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [req.params.id, req.userTenantIds || []]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    const newToken = generateApiToken();

    const result = await db.query<Site>(
      'UPDATE sites SET api_token = $1 WHERE id = $2 AND tenant_id = ANY($3) RETURNING *',
      [newToken, req.params.id, req.userTenantIds || []]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Regenerate token error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get K8s metrics for a site
router.get('/:id/k8s-metrics', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const siteId = req.params.id;

    const result = await db.query(
      `SELECT m.* FROM site_metrics m
       INNER JOIN sites s ON m.site_id = s.id
       WHERE m.site_id = $1 AND s.tenant_id = ANY($2)`,
      [siteId, req.userTenantIds || []]
    );

    if (result.rows.length === 0) {
      // Check if site exists but has no metrics, vs site not found
      const siteExists = await db.query(
        'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
        [siteId, req.userTenantIds || []]
      );
      if (siteExists.rows.length === 0) {
        res.status(404).json({ detail: 'Site not found' });
        return;
      }
      res.json(null);
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get K8s metrics for site error:', error);
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

// GET /sites/:id/k8s-metrics/history?from&to&step
router.get('/:id/k8s-metrics/history', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const siteId = parseInt(req.params.id);
    const { from, to, step } = req.query as { from?: string; to?: string; step?: string };

    // Verify site access
    const siteCheck = await db.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [req.params.id, req.userTenantIds || []]
    );
    if (siteCheck.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
    const stepSeconds = parseStepToSeconds(step);

    // Compute time bucket using epoch division to support arbitrary minute steps
    // Also JOIN on sites for defense in depth against TOCTOU
    const result = await db.query(
      `SELECT
         to_timestamp(floor(extract(epoch from h.timestamp) / $3) * $3) AS bucket,
         AVG(h.cpu_usage_percent)::float AS cpu_usage_percent,
         AVG(h.memory_usage_percent)::float AS memory_usage_percent
       FROM site_metrics_history h
       INNER JOIN sites s ON h.site_id = s.id
       WHERE h.site_id = $1 AND s.tenant_id = ANY($5)
         AND h.timestamp >= $2
         AND h.timestamp <= $4
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [siteId, fromDate.toISOString(), stepSeconds, toDate.toISOString(), req.userTenantIds || []]
    );

    res.json({
      site_id: siteId,
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

// GET /sites/:id/k8s-metrics/live -> last 30 minutes at 1m buckets
router.get('/:id/k8s-metrics/live', authMiddleware, async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const siteId = parseInt(req.params.id);

    // Verify site access
    const siteCheck = await db.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [req.params.id, req.userTenantIds || []]
    );
    if (siteCheck.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 30 * 60 * 1000);
    const stepSeconds = 60; // 1m

    // Also JOIN on sites for defense in depth against TOCTOU
    const result = await db.query(
      `SELECT
         to_timestamp(floor(extract(epoch from h.timestamp) / $3) * $3) AS bucket,
         AVG(h.cpu_usage_percent)::float AS cpu_usage_percent,
         AVG(h.memory_usage_percent)::float AS memory_usage_percent
       FROM site_metrics_history h
       INNER JOIN sites s ON h.site_id = s.id
       WHERE h.site_id = $1 AND s.tenant_id = ANY($5)
         AND h.timestamp >= $2
         AND h.timestamp <= $4
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [siteId, fromDate.toISOString(), stepSeconds, toDate.toISOString(), req.userTenantIds || []]
    );

    res.json({
      site_id: siteId,
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
