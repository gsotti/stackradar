import { Router, Response } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateApiToken, SiteRequest } from '../middleware/validateApiToken.js';
import { AuthRequest, K8sMetrics } from '../types/index.js';
// Note: stats ingest is site-scoped only; do NOT resolve or create environments/systems here

const router = Router();

interface K8sMetricsInput {
  cluster_name?: string;
  node_count?: number;
  node_ready?: number;
  pod_count?: number;
  pod_running?: number;
  pod_pending?: number;
  pod_failed?: number;
  cpu_usage_percent?: number;
  memory_usage_percent?: number;
  cpu_used_cores?: number;
  cpu_total_cores?: number;
  memory_used_gb?: number;
  memory_total_gb?: number;
  cpu_requests?: number;
  cpu_limits?: number;
  memory_requests?: number;
  memory_limits?: number;
  deployment_count?: number;
  deployment_ready?: number;
  service_count?: number;
  pvc_count?: number;
  pvc_bound?: number;
  pv_count?: number;
  namespaces?: string[] | string;
  alerts?: any[] | string;
  tenant?: string;
  system_type?: string;
  environment?: string;
  application?: string;
}

// Ingest K8s metrics
// Site-scoped stats ingest (back-compat endpoint)
router.post('/metrics/:apiToken', validateApiToken, async (
  req: SiteRequest,
  res: Response
): Promise<void> => {
  try {
    const metrics: K8sMetricsInput = req.body;
    const siteId = req.site!.id;
    const tenantId = req.site!.tenant_id;

    const client = await db.connect();
    try {
      // Check if metrics exist for this site
      const existingResult = await client.query<Pick<K8sMetrics, 'id'>>(
        'SELECT id FROM site_metrics WHERE site_id = $1',
        [siteId]
      );

      if (existingResult.rows.length > 0) {
        // Update existing metrics
        await client.query(
          `UPDATE site_metrics SET
            node_count = $1,
            node_ready = $2,
            pod_count = $3,
            pod_running = $4,
            pod_pending = $5,
            pod_failed = $6,
            deployment_count = $7,
            deployment_ready = $8,
            service_count = $9,
            cpu_usage_percent = $10,
            memory_usage_percent = $11,
            pvc_count = $12,
            pvc_bound = $13,
            pv_count = $14,
            tenant_id = $15,
            cpu_used_cores = $17,
            cpu_total_cores = $18,
            memory_used_gb = $19,
            memory_total_gb = $20,
            updated_at = CURRENT_TIMESTAMP
          WHERE site_id = $16`,
          [
            metrics.node_count || 0,
            metrics.node_ready || 0,
            metrics.pod_count || 0,
            metrics.pod_running || 0,
            metrics.pod_pending || 0,
            metrics.pod_failed || 0,
            metrics.deployment_count || 0,
            metrics.deployment_ready || 0,
            metrics.service_count || 0,
            Math.min(Math.max(metrics.cpu_usage_percent || 0, 0), 100),
            Math.min(Math.max(metrics.memory_usage_percent || 0, 0), 100),
            metrics.pvc_count || 0,
            metrics.pvc_bound || 0,
            metrics.pv_count || 0,
            tenantId,
            siteId,
            metrics.cpu_used_cores || 0,
            metrics.cpu_total_cores || 0,
            metrics.memory_used_gb || 0,
            metrics.memory_total_gb || 0
          ]
        );
      } else {
        // Insert new metrics
        await client.query(
          `INSERT INTO site_metrics (
            site_id, node_count, node_ready, pod_count, pod_running,
            pod_pending, pod_failed, deployment_count, deployment_ready,
            service_count, cpu_usage_percent, memory_usage_percent, pvc_count, pvc_bound, pv_count, tenant_id,
            cpu_used_cores, cpu_total_cores, memory_used_gb, memory_total_gb
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            siteId,
            metrics.node_count || 0,
            metrics.node_ready || 0,
            metrics.pod_count || 0,
            metrics.pod_running || 0,
            metrics.pod_pending || 0,
            metrics.pod_failed || 0,
            metrics.deployment_count || 0,
            metrics.deployment_ready || 0,
            metrics.service_count || 0,
            Math.min(Math.max(metrics.cpu_usage_percent || 0, 0), 100),
            Math.min(Math.max(metrics.memory_usage_percent || 0, 0), 100),
            metrics.pvc_count || 0,
            metrics.pvc_bound || 0,
            metrics.pv_count || 0,
            tenantId,
            metrics.cpu_used_cores || 0,
            metrics.cpu_total_cores || 0,
            metrics.memory_used_gb || 0,
            metrics.memory_total_gb || 0
          ]
        );
      }

      // Also insert a historical snapshot
      await client.query(
        `INSERT INTO site_metrics_history (
           site_id, node_count, node_ready, pod_count, pod_running,
           pod_pending, pod_failed, deployment_count, deployment_ready,
           service_count, cpu_usage_percent, memory_usage_percent, pvc_count, pvc_bound, pv_count,
           cpu_used_cores, cpu_total_cores, memory_used_gb, memory_total_gb, timestamp
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP
         )`,
        [
          siteId,
          metrics.node_count || 0,
          metrics.node_ready || 0,
          metrics.pod_count || 0,
          metrics.pod_running || 0,
          metrics.pod_pending || 0,
          metrics.pod_failed || 0,
          metrics.deployment_count || 0,
          metrics.deployment_ready || 0,
          metrics.service_count || 0,
          Math.min(Math.max(metrics.cpu_usage_percent || 0, 0), 100),
          Math.min(Math.max(metrics.memory_usage_percent || 0, 0), 100),
          metrics.pvc_count || 0,
          metrics.pvc_bound || 0,
          metrics.pv_count || 0,
          metrics.cpu_used_cores || 0,
          metrics.cpu_total_cores || 0,
          metrics.memory_used_gb || 0,
          metrics.memory_total_gb || 0
        ]
      );

      res.json({ message: 'Metrics updated' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('K8s metrics ingest error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Preferred site-scoped stats ingest endpoint (alias of /metrics)
router.post('/stats/:apiToken', validateApiToken, async (
  req: SiteRequest,
  res: Response
): Promise<void> => {
  // Delegate to the same logic as /metrics by reusing the handler above
  // Since Express doesn't easily allow calling another route handler directly,
  // duplicate minimal logic to keep behavior identical without app/env resolution.
  try {
    const metrics: K8sMetricsInput = req.body;
    const siteId = req.site!.id;
    const tenantId = req.site!.tenant_id;

    const client = await db.connect();
    try {
      const existingResult = await client.query<Pick<K8sMetrics, 'id'>>(
        'SELECT id FROM site_metrics WHERE site_id = $1',
        [siteId]
      );

      if (existingResult.rows.length > 0) {
        await client.query(
          `UPDATE site_metrics SET
            node_count = $1,
            node_ready = $2,
            pod_count = $3,
            pod_running = $4,
            pod_pending = $5,
            pod_failed = $6,
            deployment_count = $7,
            deployment_ready = $8,
            service_count = $9,
            cpu_usage_percent = $10,
            memory_usage_percent = $11,
            pvc_count = $12,
            pvc_bound = $13,
            pv_count = $14,
            tenant_id = $15,
            cpu_used_cores = $17,
            cpu_total_cores = $18,
            memory_used_gb = $19,
            memory_total_gb = $20,
            updated_at = CURRENT_TIMESTAMP
          WHERE site_id = $16`,
          [
            metrics.node_count || 0,
            metrics.node_ready || 0,
            metrics.pod_count || 0,
            metrics.pod_running || 0,
            metrics.pod_pending || 0,
            metrics.pod_failed || 0,
            metrics.deployment_count || 0,
            metrics.deployment_ready || 0,
            metrics.service_count || 0,
            Math.min(Math.max(metrics.cpu_usage_percent || 0, 0), 100),
            Math.min(Math.max(metrics.memory_usage_percent || 0, 0), 100),
            metrics.pvc_count || 0,
            metrics.pvc_bound || 0,
            metrics.pv_count || 0,
            tenantId,
            siteId,
            metrics.cpu_used_cores || 0,
            metrics.cpu_total_cores || 0,
            metrics.memory_used_gb || 0,
            metrics.memory_total_gb || 0
          ]
        );
      } else {
        await client.query(
          `INSERT INTO site_metrics (
            site_id, node_count, node_ready, pod_count, pod_running,
            pod_pending, pod_failed, deployment_count, deployment_ready,
            service_count, cpu_usage_percent, memory_usage_percent, pvc_count, pvc_bound, pv_count, tenant_id,
            cpu_used_cores, cpu_total_cores, memory_used_gb, memory_total_gb
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            siteId,
            metrics.node_count || 0,
            metrics.node_ready || 0,
            metrics.pod_count || 0,
            metrics.pod_running || 0,
            metrics.pod_pending || 0,
            metrics.pod_failed || 0,
            metrics.deployment_count || 0,
            metrics.deployment_ready || 0,
            metrics.service_count || 0,
            Math.min(Math.max(metrics.cpu_usage_percent || 0, 0), 100),
            Math.min(Math.max(metrics.memory_usage_percent || 0, 0), 100),
            metrics.pvc_count || 0,
            metrics.pvc_bound || 0,
            metrics.pv_count || 0,
            tenantId,
            metrics.cpu_used_cores || 0,
            metrics.cpu_total_cores || 0,
            metrics.memory_used_gb || 0,
            metrics.memory_total_gb || 0
          ]
        );
      }

      await client.query(
        `INSERT INTO site_metrics_history (
           site_id, node_count, node_ready, pod_count, pod_running,
           pod_pending, pod_failed, deployment_count, deployment_ready,
           service_count, cpu_usage_percent, memory_usage_percent, pvc_count, pvc_bound, pv_count,
           cpu_used_cores, cpu_total_cores, memory_used_gb, memory_total_gb, timestamp
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP
         )`,
        [
          siteId,
          metrics.node_count || 0,
          metrics.node_ready || 0,
          metrics.pod_count || 0,
          metrics.pod_running || 0,
          metrics.pod_pending || 0,
          metrics.pod_failed || 0,
          metrics.deployment_count || 0,
          metrics.deployment_ready || 0,
          metrics.service_count || 0,
          Math.min(Math.max(metrics.cpu_usage_percent || 0, 0), 100),
          Math.min(Math.max(metrics.memory_usage_percent || 0, 0), 100),
          metrics.pvc_count || 0,
          metrics.pvc_bound || 0,
          metrics.pv_count || 0,
          metrics.cpu_used_cores || 0,
          metrics.cpu_total_cores || 0,
          metrics.memory_used_gb || 0,
          metrics.memory_total_gb || 0
        ]
      );

      res.json({ message: 'Metrics updated' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('K8s stats ingest error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

interface K8sMetricsWithSiteName extends K8sMetrics {
  site_name: string;
}

interface MetricsQueryParams {
  site_id?: string;
  tenant_id?: string;
}

// Get K8s metrics

router.get('/metrics', authMiddleware, async (
  // @ts-ignore
  req: AuthRequest<{}, {}, {}, MetricsQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { site_id, tenant_id } = req.query;

    // Get all site IDs limited to the user's tenant mappings
    const tenantIds = req.userTenantIds || [];
    const userSitesResult = await db.query<{ id: number }>(
      'SELECT id FROM sites WHERE tenant_id = ANY($1)',
      [tenantIds]
    );
    const userSiteIds = userSitesResult.rows.map(s => s.id);

    if (userSiteIds.length === 0) {
      res.json([]);
      return;
    }

    if (site_id && !userSiteIds.includes(parseInt(site_id))) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    const filterSiteIds = site_id ? [parseInt(site_id)] : userSiteIds;

    // Build filter conditions
    const params: any[] = [filterSiteIds];
    let paramIndex = 2;
    let filterClause = '';

    if (tenant_id) {
      filterClause += ` AND k.tenant_id = $${paramIndex}`;
      params.push(parseInt(tenant_id));
      paramIndex++;
    }

    const metricsResult = await db.query<K8sMetricsWithSiteName>(
      `SELECT k.*, s.name as site_name FROM site_metrics k
       JOIN sites s ON k.site_id = s.id
       WHERE k.site_id = ANY($1)${filterClause}`,
      params
    );

    res.json(metricsResult.rows);
  } catch (error) {
    console.error('Get K8s metrics error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
