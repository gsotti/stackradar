import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db/database.js';
import { IngestLogRequest, IngestLogsRequest } from '../types/index.js';
import { validateApiToken, SystemRequest } from '../middleware/validateApiToken.js';
import { resolveHierarchy } from '../services/hierarchy.js';

const router = Router();

// Rate limiter for ingest endpoints
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute per token
  keyGenerator: (req) => req.params.apiToken,
  message: { detail: 'Too many requests, please slow down' }
});

// Ingest multiple logs
router.post('/:apiToken', ingestLimiter, validateApiToken, async (
  req: SystemRequest,
  res: Response
): Promise<void> => {
  try {
    const { logs }: IngestLogsRequest = req.body;

    if (!Array.isArray(logs) || logs.length === 0) {
      res.status(400).json({ detail: 'logs array is required' });
      return;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Get system's tenant_id once for all logs
      const systemResult = await client.query<{ tenant_id: number }>(
        'SELECT tenant_id FROM systems WHERE id = $1',
        [req.system!.id]
      );
      const tenantId = systemResult.rows[0]?.tenant_id || null;

      let count = 0;
      for (const log of logs) {
        // Resolve hierarchy (environment_id and application_id)
        const { environmentId, applicationId } = await resolveHierarchy(
          client,
          req.system!.id,
          log.environment,
          log.application
        );

        await client.query(
          `INSERT INTO log_entries (
            environment_id, timestamp, level, message, source, metadata,
            tenant, application,
            tenant_id, application_id
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            environmentId,
            log.timestamp || new Date().toISOString(),
            (log.level || 'INFO').toUpperCase(),
            log.message,
            log.source || null,
            log.metadata ? (typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)) : null,
            log.tenant || null,
            log.application || null,
            tenantId,
            applicationId
          ]
        );
        count++;
      }

      await client.query('COMMIT');
      res.json({ message: `Ingested ${count} logs`, count });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ingest logs error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Ingest single log
router.post('/:apiToken/single', ingestLimiter, validateApiToken, async (
  req: SystemRequest,
  res: Response
): Promise<void> => {
  try {
    const { level = 'INFO', message, source, metadata, timestamp, tenant, environment, application }: IngestLogRequest = req.body;

    if (!message) {
      res.status(400).json({ detail: 'message is required' });
      return;
    }

    const client = await db.connect();
    try {
      // Get system's tenant_id
      const systemResult = await client.query<{ tenant_id: number }>(
        'SELECT tenant_id FROM systems WHERE id = $1',
        [req.system!.id]
      );
      const tenantId = systemResult.rows[0]?.tenant_id || null;

      // Resolve hierarchy (environment_id and application_id)
      const { environmentId, applicationId } = await resolveHierarchy(
        client,
        req.system!.id,
        environment,
        application
      );

      const result = await client.query<{ id: number }>(
        `INSERT INTO log_entries (
          environment_id, timestamp, level, message, source, metadata,
          tenant, application,
          tenant_id, application_id
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          environmentId,
          timestamp || new Date().toISOString(),
          level.toUpperCase(),
          message,
          source || null,
          metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
          tenant || null,
          application || null,
          tenantId,
          applicationId
        ]
      );

      res.json({ message: 'Log ingested', id: result.rows[0].id });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ingest single log error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
