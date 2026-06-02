import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import https from 'https';
import http from 'http';
import db from '../db/database.js';
import { IngestLogRequest, IngestLogsRequest } from '../types/index.js';
import { validateApiToken, SiteRequest } from '../middleware/validateApiToken.js';
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
  req: SiteRequest,
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

      // Get tenant_id from the site
      const tenantId = req.site!.tenant_id;

      let count = 0;
      for (const log of logs) {
        // Resolve hierarchy (site_id, environment, and system)
        const { systemId } = await resolveHierarchy(
          client,
          req.site!.id,
          log.environment,
          log.system
        );

        await client.query(
          `INSERT INTO log_entries (
            system_id, timestamp, level, message, source, metadata,
            tenant, site, environment, system, tenant_id
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            systemId,
            log.timestamp || new Date().toISOString(),
            (log.level || 'INFO').toUpperCase(),
            log.message,
            log.source || null,
            log.metadata ? (typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)) : null,
            log.tenant || null,
            log.site || null,
            log.environment || null,
            log.system || null,
            tenantId
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
  req: SiteRequest,
  res: Response
): Promise<void> => {
  try {
    const { level = 'INFO', message, source, metadata, timestamp, tenant, environment, system }: IngestLogRequest = req.body;

    if (!message) {
      res.status(400).json({ detail: 'message is required' });
      return;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Get tenant_id from the site
      const tenantId = req.site!.tenant_id;

      // Resolve hierarchy (site_id, environment, and system)
      const { systemId } = await resolveHierarchy(
        client,
        req.site!.id,
        environment,
        system
      );

      const result = await client.query<{ id: number }>(
        `INSERT INTO log_entries (
          system_id, timestamp, level, message, source, metadata,
          tenant, site, environment, system, tenant_id
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [
          systemId,
          timestamp || new Date().toISOString(),
          level.toUpperCase(),
          message,
          source || null,
          metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
          tenant || null,
          null, // site (text) - can be populated if needed
          environment || null,
          system || null,
          tenantId
        ]
      );

      await client.query('COMMIT');
      res.json({ message: 'Log ingested', id: result.rows[0].id });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ingest single log error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// SNS → ingest: handles CloudWatch alarm notifications delivered via SNS HTTPS subscription
router.post('/:apiToken/sns', ingestLimiter, validateApiToken, async (
  req: SiteRequest,
  res: Response
): Promise<void> => {
  const messageType = req.headers['x-amz-sns-message-type'] as string;

  // SNS sends JSON as text/plain or application/json
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  // Step 1: confirm the subscription by fetching the SubscribeURL SNS provides
  if (messageType === 'SubscriptionConfirmation') {
    const subscribeUrl = body.SubscribeURL as string;
    if (!subscribeUrl) {
      res.status(400).json({ detail: 'Missing SubscribeURL' });
      return;
    }
    await new Promise<void>((resolve) => {
      const lib = subscribeUrl.startsWith('https') ? https : http;
      lib.get(subscribeUrl, (r) => { r.resume(); resolve(); }).on('error', resolve);
    });
    res.status(200).send('OK');
    return;
  }

  if (messageType !== 'Notification') {
    res.status(200).send('OK');
    return;
  }

  try {
    // The Message field is a JSON string containing the CloudWatch alarm payload
    let alarm: Record<string, unknown>;
    try {
      alarm = JSON.parse(body.Message as string);
    } catch {
      // Not a CloudWatch alarm JSON — ingest raw message as info log
      alarm = { AlarmName: 'SNS', NewStateValue: 'INFO', StateChangeTime: body.Timestamp, NewStateReason: body.Message };
    }

    const stateValue = (alarm.NewStateValue as string || 'INFO').toUpperCase();
    const levelMap: Record<string, string> = { ALARM: 'ERROR', OK: 'INFO', INSUFFICIENT_DATA: 'WARN' };
    const level = levelMap[stateValue] || 'INFO';

    const alarmName = alarm.AlarmName as string || 'CloudWatch Alarm';
    const reason = alarm.NewStateReason as string || '';
    const message = `[${stateValue}] ${alarmName}${reason ? ': ' + reason : ''}`;
    const timestamp = alarm.StateChangeTime as string || new Date().toISOString();

    const metadata = {
      alarm_name: alarmName,
      alarm_arn: alarm.AlarmArn,
      old_state: alarm.OldStateValue,
      new_state: alarm.NewStateValue,
      region: alarm.Region,
      account_id: alarm.AWSAccountId,
      trigger: alarm.Trigger,
    };

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const { systemId } = await resolveHierarchy(client, req.site!.id, undefined, alarmName);
      await client.query(
        `INSERT INTO log_entries (
          system_id, timestamp, level, message, source, metadata,
          tenant, site, environment, system, tenant_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          systemId,
          timestamp,
          level,
          message,
          'cloudwatch-alarm',
          JSON.stringify(metadata),
          null, null, null, alarmName,
          req.site!.tenant_id,
        ]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('SNS ingest error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
