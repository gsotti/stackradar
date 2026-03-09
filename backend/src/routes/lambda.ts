import { Router, Response } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateApiToken, SiteRequest } from '../middleware/validateApiToken.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

interface LambdaFunctionInput {
  function_name: string;
  invocations?: number;
  errors?: number;
  throttles?: number;
  avg_duration_ms?: number;
  max_duration_ms?: number;
  concurrent_executions?: number;
  iterator_age_ms?: number;
  memory_size_mb?: number;
  timeout_seconds?: number;
  runtime?: string;
  last_modified?: string;
}

interface LambdaIngestBody {
  functions: LambdaFunctionInput[];
}

// POST /api/lambda/metrics/:apiToken — Ingest Lambda metrics from collector
router.post('/metrics/:apiToken', validateApiToken, async (
  req: SiteRequest,
  res: Response
): Promise<void> => {
  try {
    const { functions }: LambdaIngestBody = req.body;

    if (!Array.isArray(functions) || functions.length === 0) {
      res.status(400).json({ detail: 'functions array is required' });
      return;
    }

    const siteId = req.site!.id;
    const tenantId = req.site!.tenant_id;

    const client = await db.connect();
    try {
      for (const fn of functions) {
        if (!fn.function_name) continue;

        await client.query(
          `INSERT INTO lambda_metrics (
            site_id, function_name, invocations, errors, throttles,
            avg_duration_ms, max_duration_ms, concurrent_executions,
            iterator_age_ms, memory_size_mb, timeout_seconds, runtime,
            last_modified, tenant_id, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
          ON CONFLICT (site_id, function_name) DO UPDATE SET
            invocations = EXCLUDED.invocations,
            errors = EXCLUDED.errors,
            throttles = EXCLUDED.throttles,
            avg_duration_ms = EXCLUDED.avg_duration_ms,
            max_duration_ms = EXCLUDED.max_duration_ms,
            concurrent_executions = EXCLUDED.concurrent_executions,
            iterator_age_ms = EXCLUDED.iterator_age_ms,
            memory_size_mb = EXCLUDED.memory_size_mb,
            timeout_seconds = EXCLUDED.timeout_seconds,
            runtime = EXCLUDED.runtime,
            last_modified = EXCLUDED.last_modified,
            tenant_id = EXCLUDED.tenant_id,
            updated_at = CURRENT_TIMESTAMP`,
          [
            siteId,
            fn.function_name,
            fn.invocations ?? 0,
            fn.errors ?? 0,
            fn.throttles ?? 0,
            fn.avg_duration_ms ?? 0,
            fn.max_duration_ms ?? 0,
            fn.concurrent_executions ?? 0,
            fn.iterator_age_ms ?? 0,
            fn.memory_size_mb ?? 0,
            fn.timeout_seconds ?? 0,
            fn.runtime ?? null,
            fn.last_modified ?? null,
            tenantId
          ]
        );

        await client.query(
          `INSERT INTO lambda_metrics_history (
            site_id, function_name, invocations, errors, throttles,
            avg_duration_ms, max_duration_ms, concurrent_executions, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
          [
            siteId,
            fn.function_name,
            fn.invocations ?? 0,
            fn.errors ?? 0,
            fn.throttles ?? 0,
            fn.avg_duration_ms ?? 0,
            fn.max_duration_ms ?? 0,
            fn.concurrent_executions ?? 0
          ]
        );
      }

      res.json({ received: functions.length });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Lambda metrics ingest error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

interface LambdaMetricsQueryParams {
  site_id?: string;
}

// GET /api/lambda/metrics — Retrieve current Lambda metrics for a site
router.get('/metrics', authMiddleware, async (
  // @ts-ignore
  req: AuthRequest<{}, {}, {}, LambdaMetricsQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { site_id } = req.query;

    if (!site_id) {
      res.status(400).json({ detail: 'site_id is required' });
      return;
    }

    const siteIdNum = parseInt(site_id, 10);
    if (isNaN(siteIdNum)) {
      res.status(400).json({ detail: 'site_id must be a number' });
      return;
    }

    // Verify site access via tenant membership
    const siteCheck = await db.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [siteIdNum, req.userTenantIds || []]
    );
    if (siteCheck.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    const result = await db.query(
      `SELECT * FROM lambda_metrics WHERE site_id = $1 ORDER BY function_name ASC`,
      [siteIdNum]
    );

    const functions = result.rows;

    const functionCount = functions.length;
    const totalInvocations = functions.reduce((sum: number, f: any) => sum + (f.invocations ?? 0), 0);
    const totalErrors = functions.reduce((sum: number, f: any) => sum + (f.errors ?? 0), 0);
    const totalThrottles = functions.reduce((sum: number, f: any) => sum + (f.throttles ?? 0), 0);
    const avgDurationMs = functionCount > 0
      ? functions.reduce((sum: number, f: any) => sum + (f.avg_duration_ms ?? 0), 0) / functionCount
      : 0;
    const errorRatePercent = totalInvocations > 0
      ? (totalErrors / totalInvocations) * 100
      : 0;

    res.json({
      functions,
      aggregate: {
        function_count: functionCount,
        total_invocations: totalInvocations,
        total_errors: totalErrors,
        total_throttles: totalThrottles,
        avg_duration_ms: avgDurationMs,
        error_rate_percent: errorRatePercent
      }
    });
  } catch (error) {
    console.error('Get Lambda metrics error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Helper to parse step string into seconds
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

interface LambdaHistoryQueryParams {
  site_id?: string;
  function_name?: string;
  from?: string;
  to?: string;
  step?: string;
}

// GET /api/lambda/metrics/history — Time-bucketed historical Lambda metrics
router.get('/metrics/history', authMiddleware, async (
  // @ts-ignore
  req: AuthRequest<{}, {}, {}, LambdaHistoryQueryParams>,
  res: Response
): Promise<void> => {
  try {
    const { site_id, function_name, from, to, step } = req.query;

    if (!site_id) {
      res.status(400).json({ detail: 'site_id is required' });
      return;
    }

    const siteIdNum = parseInt(site_id, 10);
    if (isNaN(siteIdNum)) {
      res.status(400).json({ detail: 'site_id must be a number' });
      return;
    }

    // Verify site access via tenant membership
    const siteCheck = await db.query(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
      [siteIdNum, req.userTenantIds || []]
    );
    if (siteCheck.rows.length === 0) {
      res.status(404).json({ detail: 'Site not found' });
      return;
    }

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
    const stepSeconds = parseStepToSeconds(step);

    const params: any[] = [siteIdNum, fromDate.toISOString(), stepSeconds, toDate.toISOString(), req.userTenantIds || []];
    let functionFilter = '';

    if (function_name) {
      params.push(function_name);
      functionFilter = ` AND h.function_name = $${params.length}`;
    }

    const result = await db.query(
      `SELECT
         to_timestamp(floor(extract(epoch from h.timestamp) / $3) * $3) AS bucket,
         h.function_name,
         SUM(h.invocations)::integer AS invocations,
         SUM(h.errors)::integer AS errors,
         SUM(h.throttles)::integer AS throttles,
         AVG(h.avg_duration_ms)::float AS avg_duration_ms,
         MAX(h.max_duration_ms)::float AS max_duration_ms,
         AVG(h.concurrent_executions)::float AS concurrent_executions
       FROM lambda_metrics_history h
       INNER JOIN sites s ON h.site_id = s.id
       WHERE h.site_id = $1 AND s.tenant_id = ANY($5)
         AND h.timestamp >= $2
         AND h.timestamp <= $4
         ${functionFilter}
       GROUP BY bucket, h.function_name
       ORDER BY bucket ASC, h.function_name ASC`,
      params
    );

    res.json({
      site_id: siteIdNum,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      step: stepSeconds,
      function_name: function_name || null,
      points: result.rows.map((r: any) => ({
        timestamp: r.bucket,
        function_name: r.function_name,
        invocations: r.invocations ?? 0,
        errors: r.errors ?? 0,
        throttles: r.throttles ?? 0,
        avg_duration_ms: r.avg_duration_ms ?? 0,
        max_duration_ms: r.max_duration_ms ?? 0,
        concurrent_executions: r.concurrent_executions ?? 0
      }))
    });
  } catch (error) {
    console.error('Get Lambda metrics history error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
