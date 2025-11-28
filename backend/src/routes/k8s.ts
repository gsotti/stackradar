import { Router, Response } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateApiToken, SystemRequest } from '../middleware/validateApiToken.js';
import { AuthRequest, System, K8sMetrics } from '../types/index.js';

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
  cpu_requests?: number;
  cpu_limits?: number;
  memory_requests?: number;
  memory_limits?: number;
  deployment_count?: number;
  deployment_ready?: number;
  service_count?: number;
  pvc_count?: number;
  pvc_bound?: number;
  namespaces?: string[] | string;
  alerts?: any[] | string;
}

// Ingest K8s metrics
router.post('/metrics/:apiToken', validateApiToken, async (
  req: SystemRequest,
  res: Response
): Promise<void> => {
  try {
    const metrics: K8sMetricsInput = req.body;
    const systemId = req.system!.id;

    // Check if metrics exist for this system
    const existingResult = await db.query<Pick<K8sMetrics, 'id'>>(
      'SELECT id FROM k8s_metrics WHERE system_id = $1',
      [systemId]
    );

    if (existingResult.rows.length > 0) {
      // Update existing metrics
      await db.query(
        `UPDATE k8s_metrics SET
          cluster_name = $1,
          node_count = $2,
          node_ready = $3,
          pod_count = $4,
          pod_running = $5,
          pod_pending = $6,
          pod_failed = $7,
          cpu_usage_percent = $8,
          memory_usage_percent = $9,
          cpu_requests = $10,
          cpu_limits = $11,
          memory_requests = $12,
          memory_limits = $13,
          deployment_count = $14,
          deployment_ready = $15,
          service_count = $16,
          pvc_count = $17,
          pvc_bound = $18,
          namespaces = $19,
          alerts = $20,
          updated_at = CURRENT_TIMESTAMP
        WHERE system_id = $21`,
        [
          metrics.cluster_name || null,
          metrics.node_count || 0,
          metrics.node_ready || 0,
          metrics.pod_count || 0,
          metrics.pod_running || 0,
          metrics.pod_pending || 0,
          metrics.pod_failed || 0,
          metrics.cpu_usage_percent || 0,
          metrics.memory_usage_percent || 0,
          metrics.cpu_requests || 0,
          metrics.cpu_limits || 0,
          metrics.memory_requests || 0,
          metrics.memory_limits || 0,
          metrics.deployment_count || 0,
          metrics.deployment_ready || 0,
          metrics.service_count || 0,
          metrics.pvc_count || 0,
          metrics.pvc_bound || 0,
          metrics.namespaces ? JSON.stringify(metrics.namespaces) : null,
          metrics.alerts ? JSON.stringify(metrics.alerts) : null,
          systemId
        ]
      );
    } else {
      // Insert new metrics
      await db.query(
        `INSERT INTO k8s_metrics (
          system_id, cluster_name, node_count, node_ready, pod_count, pod_running,
          pod_pending, pod_failed, cpu_usage_percent, memory_usage_percent,
          cpu_requests, cpu_limits, memory_requests, memory_limits,
          deployment_count, deployment_ready, service_count, pvc_count, pvc_bound,
          namespaces, alerts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          systemId,
          metrics.cluster_name || null,
          metrics.node_count || 0,
          metrics.node_ready || 0,
          metrics.pod_count || 0,
          metrics.pod_running || 0,
          metrics.pod_pending || 0,
          metrics.pod_failed || 0,
          metrics.cpu_usage_percent || 0,
          metrics.memory_usage_percent || 0,
          metrics.cpu_requests || 0,
          metrics.cpu_limits || 0,
          metrics.memory_requests || 0,
          metrics.memory_limits || 0,
          metrics.deployment_count || 0,
          metrics.deployment_ready || 0,
          metrics.service_count || 0,
          metrics.pvc_count || 0,
          metrics.pvc_bound || 0,
          metrics.namespaces ? JSON.stringify(metrics.namespaces) : null,
          metrics.alerts ? JSON.stringify(metrics.alerts) : null
        ]
      );
    }

    res.json({ message: 'Metrics updated' });
  } catch (error) {
    console.error('K8s metrics ingest error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

interface K8sMetricsWithSystemName extends K8sMetrics {
  system_name: string;
}

interface MetricsQueryParams {
  system_id?: string;
}

// Get K8s metrics

router.get('/metrics', authMiddleware, async (
  // @ts-ignore
  req: AuthRequest<{}, {}, {}, MetricsQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { system_id } = req.query;

    // Get user's system IDs
    const userSystemsResult = await db.query<Pick<System, 'id'>>(
      'SELECT id FROM systems WHERE user_id = $1',
      [req.userId]
    );
    const userSystemIds = userSystemsResult.rows.map((s: { id: any; }) => s.id);

    if (userSystemIds.length === 0) {
      res.json([]);
      return;
    }

    if (system_id && !userSystemIds.includes(parseInt(system_id))) {
      res.status(403).json({ detail: 'Access denied' });
      return;
    }

    const filterSystemIds = system_id ? [parseInt(system_id)] : userSystemIds;

    const metricsResult = await db.query<K8sMetricsWithSystemName>(
      `SELECT k.*, s.name as system_name FROM k8s_metrics k
       JOIN systems s ON k.system_id = s.id
       WHERE k.system_id = ANY($1)`,
      [filterSystemIds]
    );

    res.json(metricsResult.rows);
  } catch (error) {
    console.error('Get K8s metrics error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
