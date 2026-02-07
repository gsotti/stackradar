import { Router, Response } from 'express';
import https from 'https';
import http from 'http';
import db from '../db/database.js';
import { authMiddleware, adminMiddleware, editorMiddleware } from '../middleware/auth.js';
import {
  testSmtpConfig,
  clearSmtpConfigCache,
} from '../services/alerting/smtp.js';
import { evaluateRule, getCurrentMetricValue } from '../services/alerting/evaluator.js';
import { renderTemplate } from '../services/email/templateRenderer.js';
import {
  AuthRequest,
  AlertRule,
  NotificationChannel,
  AlertHistory,
  SmtpConfig,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  CreateNotificationChannelRequest,
  UpdateNotificationChannelRequest,
  CreateSmtpConfigRequest,
  UpdateSmtpConfigRequest,
} from '../types/index.js';

const router = Router();

// ============================================================================
// ALERT RULES ENDPOINTS
// ============================================================================

// Get all alert rules for a site
router.get(
  '/rules',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { site_id } = req.query;

      if (!site_id) {
        res.status(400).json({ detail: 'site_id query parameter is required' });
        return;
      }

      const allowed = req.userTenantIds || [];
      if (!allowed.length) {
        res.json([]);
        return;
      }

      // Get alert rules with channel associations and monitor name
      const result = await db.query<AlertRule & { channel_ids: number[]; monitor_name: string | null }>(
        `SELECT ar.*,
          COALESCE(
            (SELECT array_agg(arc.notification_channel_id)
             FROM alert_rule_channels arc
             WHERE arc.alert_rule_id = ar.id),
            '{}'::int[]
          ) as channel_ids,
          um.name as monitor_name
         FROM alert_rules ar
         INNER JOIN sites s ON ar.site_id = s.id
         LEFT JOIN uptime_monitors um ON ar.monitor_id = um.id
         WHERE ar.site_id = $1 AND s.tenant_id = ANY($2)
         ORDER BY ar.created_at DESC`,
        [site_id, allowed]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get alert rules error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Get single alert rule
router.get(
  '/rules/:id',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const allowed = req.userTenantIds || [];

      const result = await db.query<AlertRule & { channel_ids: number[] }>(
        `SELECT ar.*,
          COALESCE(
            (SELECT array_agg(arc.notification_channel_id)
             FROM alert_rule_channels arc
             WHERE arc.alert_rule_id = ar.id),
            '{}'::int[]
          ) as channel_ids
         FROM alert_rules ar
         INNER JOIN sites s ON ar.site_id = s.id
         WHERE ar.id = $1 AND s.tenant_id = ANY($2)`,
        [id, allowed]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ detail: 'Alert rule not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get alert rule error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Create alert rule
router.post(
  '/rules',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as CreateAlertRuleRequest;
      const allowed = req.userTenantIds || [];
      const alertType = body.alert_type || 'metric';

      // Validate required fields based on alert type
      if (!body.site_id || !body.name) {
        res.status(400).json({ detail: 'Missing required fields: site_id and name are required' });
        return;
      }

      if (alertType === 'metric') {
        if (!body.metric_type || !body.threshold_operator || body.threshold_value === undefined) {
          res.status(400).json({ detail: 'Missing required fields for metric alert' });
          return;
        }
      } else if (alertType === 'uptime') {
        if (!body.monitor_id) {
          res.status(400).json({ detail: 'Missing required fields: monitor_id is required for uptime alert' });
          return;
        }
      }

      // Check site access
      const siteCheck = await db.query(
        'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
        [body.site_id, allowed]
      );

      if (siteCheck.rows.length === 0) {
        res.status(404).json({ detail: 'Site not found or access denied' });
        return;
      }

      // If uptime alert, verify monitor belongs to site
      if (alertType === 'uptime' && body.monitor_id) {
        const monitorCheck = await db.query(
          'SELECT id FROM uptime_monitors WHERE id = $1 AND site_id = $2',
          [body.monitor_id, body.site_id]
        );
        if (monitorCheck.rows.length === 0) {
          res.status(400).json({ detail: 'Monitor not found or does not belong to this site' });
          return;
        }
      }

      // Create alert rule
      const result = await db.query<AlertRule>(
        `INSERT INTO alert_rules (
          site_id, name, description, alert_type, metric_type, threshold_operator,
          threshold_value, time_window_minutes, cooldown_minutes, failure_threshold, 
          repeat_interval_hours, severity, monitor_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          body.site_id,
          body.name,
          body.description || null,
          alertType,
          alertType === 'metric' ? body.metric_type : null,
          alertType === 'metric' ? body.threshold_operator : null,
          alertType === 'metric' ? body.threshold_value : null,
          body.time_window_minutes || 5,
          body.cooldown_minutes || 30,
          alertType === 'uptime' ? (body.failure_threshold || 3) : null,
          body.repeat_interval_hours || 1,
          body.severity || 'warning',
          alertType === 'uptime' ? body.monitor_id : null,
          req.userId,
        ]
      );

      const rule = result.rows[0];

      // Associate with notification channels
      if (body.notification_channel_ids && body.notification_channel_ids.length > 0) {
        for (const channelId of body.notification_channel_ids) {
          await db.query(
            'INSERT INTO alert_rule_channels (alert_rule_id, notification_channel_id) VALUES ($1, $2)',
            [rule.id, channelId]
          );
        }
      }

      res.status(201).json(rule);
    } catch (error) {
      console.error('Create alert rule error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Update alert rule
router.put(
  '/rules/:id',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateAlertRuleRequest;
      const allowed = req.userTenantIds || [];

      // Check access
      const accessCheck = await db.query(
        `SELECT ar.id FROM alert_rules ar
         INNER JOIN sites s ON ar.site_id = s.id
         WHERE ar.id = $1 AND s.tenant_id = ANY($2)`,
        [id, allowed]
      );

      if (accessCheck.rows.length === 0) {
        res.status(404).json({ detail: 'Alert rule not found' });
        return;
      }

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (body.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(body.name);
      }
      if (body.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(body.description);
      }
      if (body.alert_type !== undefined) {
        updates.push(`alert_type = $${paramCount++}`);
        values.push(body.alert_type);
      }
      if (body.metric_type !== undefined) {
        updates.push(`metric_type = $${paramCount++}`);
        values.push(body.metric_type);
      }
      if (body.threshold_operator !== undefined) {
        updates.push(`threshold_operator = $${paramCount++}`);
        values.push(body.threshold_operator);
      }
      if (body.threshold_value !== undefined) {
        updates.push(`threshold_value = $${paramCount++}`);
        values.push(body.threshold_value);
      }
      if (body.time_window_minutes !== undefined) {
        updates.push(`time_window_minutes = $${paramCount++}`);
        values.push(body.time_window_minutes);
      }
      if (body.severity !== undefined) {
        updates.push(`severity = $${paramCount++}`);
        values.push(body.severity);
      }
      if (body.enabled !== undefined) {
        updates.push(`enabled = $${paramCount++}`);
        values.push(body.enabled);
      }
      if (body.cooldown_minutes !== undefined) {
        updates.push(`cooldown_minutes = $${paramCount++}`);
        values.push(body.cooldown_minutes);
      }
      if (body.failure_threshold !== undefined) {
        updates.push(`failure_threshold = $${paramCount++}`);
        values.push(body.failure_threshold);
      }
      if (body.repeat_interval_hours !== undefined) {
        updates.push(`repeat_interval_hours = $${paramCount++}`);
        values.push(body.repeat_interval_hours);
      }
      if (body.monitor_id !== undefined) {
        updates.push(`monitor_id = $${paramCount++}`);
        values.push(body.monitor_id);
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query<AlertRule>(
        `UPDATE alert_rules SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      // Update channel associations if provided
      if (body.notification_channel_ids !== undefined) {
        await db.query('DELETE FROM alert_rule_channels WHERE alert_rule_id = $1', [id]);
        for (const channelId of body.notification_channel_ids) {
          await db.query(
            'INSERT INTO alert_rule_channels (alert_rule_id, notification_channel_id) VALUES ($1, $2)',
            [id, channelId]
          );
        }
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update alert rule error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Delete alert rule
router.delete(
  '/rules/:id',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const allowed = req.userTenantIds || [];

      const result = await db.query(
        `DELETE FROM alert_rules ar
         USING sites s
         WHERE ar.site_id = s.id AND ar.id = $1 AND s.tenant_id = ANY($2)
         RETURNING ar.id`,
        [id, allowed]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ detail: 'Alert rule not found' });
        return;
      }

      res.json({ detail: 'Alert rule deleted successfully' });
    } catch (error) {
      console.error('Delete alert rule error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Test alert rule (manual trigger)
router.post(
  '/rules/:id/test',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const allowed = req.userTenantIds || [];

      // Get rule
      const ruleResult = await db.query<AlertRule>(
        `SELECT ar.* FROM alert_rules ar
         INNER JOIN sites s ON ar.site_id = s.id
         WHERE ar.id = $1 AND s.tenant_id = ANY($2)`,
        [id, allowed]
      );

      if (ruleResult.rows.length === 0) {
        res.status(404).json({ detail: 'Alert rule not found' });
        return;
      }

      const rule = ruleResult.rows[0];

      // Only metric alerts can be tested this way
      if (rule.alert_type === 'uptime') {
        res.status(400).json({ detail: 'Uptime alerts cannot be tested manually. Use the monitor check endpoint instead.' });
        return;
      }

      if (!rule.metric_type) {
        res.status(400).json({ detail: 'Alert rule has no metric type configured' });
        return;
      }

      // Get current metric value
      const metricValue = await getCurrentMetricValue(
        rule.site_id,
        rule.metric_type,
        rule.time_window_minutes
      );

      if (metricValue === null) {
        res.status(400).json({ detail: 'No metric data available for this system' });
        return;
      }

      // Evaluate the rule (this will trigger notifications)
      await evaluateRule(rule);

      res.json({
        detail: 'Alert rule tested successfully',
        current_value: metricValue,
        threshold: rule.threshold_value,
      });
    } catch (error) {
      console.error('Test alert rule error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// ============================================================================
// NOTIFICATION CHANNELS ENDPOINTS
// ============================================================================

// Get notification channels for a site
router.get(
  '/channels',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { site_id } = req.query;

      if (!site_id) {
        res.status(400).json({ detail: 'site_id query parameter is required' });
        return;
      }

      const allowed = req.userTenantIds || [];

      const result = await db.query<NotificationChannel>(
        `SELECT nc.* FROM notification_channels nc
         INNER JOIN sites s ON nc.site_id = s.id
         WHERE nc.site_id = $1 AND s.tenant_id = ANY($2)
         ORDER BY nc.created_at DESC`,
        [site_id, allowed]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get notification channels error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Create notification channel
router.post(
  '/channels',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as CreateNotificationChannelRequest;
      const allowed = req.userTenantIds || [];

      // Validate required fields
      if (!body.site_id || !body.name || !body.channel_type) {
        res.status(400).json({ detail: 'Missing required fields' });
        return;
      }

      // Check site access
      const siteCheck = await db.query(
        'SELECT id FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
        [body.site_id, allowed]
      );

      if (siteCheck.rows.length === 0) {
        res.status(404).json({ detail: 'Site not found or access denied' });
        return;
      }

      // Validate channel-specific fields
      if (body.channel_type === 'email' && (!body.email_recipients || body.email_recipients.length === 0)) {
        res.status(400).json({ detail: 'Email recipients required for email channel' });
        return;
      }

      if (body.channel_type === 'webhook' && !body.webhook_url) {
        res.status(400).json({ detail: 'Webhook URL required for webhook channel' });
        return;
      }

      // Create notification channel
      const result = await db.query<NotificationChannel>(
        `INSERT INTO notification_channels (
          site_id, name, channel_type, email_recipients,
          webhook_url, webhook_headers
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          body.site_id,
          body.name,
          body.channel_type,
          body.email_recipients || null,
          body.webhook_url || null,
          body.webhook_headers ? JSON.stringify(body.webhook_headers) : null,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create notification channel error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Update notification channel
router.put(
  '/channels/:id',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateNotificationChannelRequest;
      const allowed = req.userTenantIds || [];

      // Check access
      const accessCheck = await db.query(
        `SELECT nc.id FROM notification_channels nc
         INNER JOIN sites s ON nc.site_id = s.id
         WHERE nc.id = $1 AND s.tenant_id = ANY($2)`,
        [id, allowed]
      );

      if (accessCheck.rows.length === 0) {
        res.status(404).json({ detail: 'Notification channel not found' });
        return;
      }

      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (body.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(body.name);
      }
      if (body.enabled !== undefined) {
        updates.push(`enabled = $${paramCount++}`);
        values.push(body.enabled);
      }
      if (body.email_recipients !== undefined) {
        updates.push(`email_recipients = $${paramCount++}`);
        values.push(body.email_recipients);
      }
      if (body.webhook_url !== undefined) {
        updates.push(`webhook_url = $${paramCount++}`);
        values.push(body.webhook_url);
      }
      if (body.webhook_headers !== undefined) {
        updates.push(`webhook_headers = $${paramCount++}`);
        values.push(JSON.stringify(body.webhook_headers));
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query<NotificationChannel>(
        `UPDATE notification_channels SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update notification channel error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Delete notification channel
router.delete(
  '/channels/:id',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const allowed = req.userTenantIds || [];

      const result = await db.query(
        `DELETE FROM notification_channels nc
         USING sites s
         WHERE nc.site_id = s.id AND nc.id = $1 AND s.tenant_id = ANY($2)
         RETURNING nc.id`,
        [id, allowed]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ detail: 'Notification channel not found' });
        return;
      }

      res.json({ detail: 'Notification channel deleted successfully' });
    } catch (error) {
      console.error('Delete notification channel error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// ============================================================================
// ALERT HISTORY ENDPOINTS
// ============================================================================

// Get alert history
router.get(
  '/history',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { site_id, state, limit = '50', offset = '0' } = req.query;

      if (!site_id) {
        res.status(400).json({ detail: 'site_id query parameter is required' });
        return;
      }

      const allowed = req.userTenantIds || [];

      let query = `
        SELECT ah.*, ar.name as rule_name, ar.metric_type, ar.severity
        FROM alert_history ah
        INNER JOIN alert_rules ar ON ah.alert_rule_id = ar.id
        INNER JOIN sites s ON ah.site_id = s.id
        WHERE ah.site_id = $1 AND s.tenant_id = ANY($2)
      `;
      const params: any[] = [site_id, allowed];
      let paramCount = 3;

      if (state) {
        query += ` AND ah.state = $${paramCount++}`;
        params.push(state);
      }

      query += ` ORDER BY ah.triggered_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.query(query, params);

      res.json(result.rows);
    } catch (error) {
      console.error('Get alert history error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Get active (firing) alerts
router.get(
  '/active',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { site_id } = req.query;

      if (!site_id) {
        res.status(400).json({ detail: 'site_id query parameter is required' });
        return;
      }

      const allowed = req.userTenantIds || [];

      const result = await db.query(
        `SELECT ah.*, ar.name as rule_name, ar.metric_type, ar.severity
         FROM alert_history ah
         INNER JOIN alert_rules ar ON ah.alert_rule_id = ar.id
         INNER JOIN sites s ON ah.site_id = s.id
         WHERE ah.site_id = $1 AND s.tenant_id = ANY($2)
           AND ah.state = 'firing' AND ah.resolved_at IS NULL
         ORDER BY ah.triggered_at DESC`,
        [site_id, allowed]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get active alerts error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Manually resolve an alert
router.post(
  '/history/:id/resolve',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const allowed = req.userTenantIds || [];

      // Check access and update
      const result = await db.query<AlertHistory>(
        `UPDATE alert_history ah
         SET state = 'resolved', resolved_at = NOW()
         FROM sites s
         WHERE ah.site_id = s.id AND ah.id = $1 AND s.tenant_id = ANY($2)
           AND ah.state = 'firing'
         RETURNING ah.*`,
        [id, allowed]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ detail: 'Alert not found or already resolved' });
        return;
      }

      res.json({ detail: 'Alert resolved successfully' });
    } catch (error) {
      console.error('Resolve alert error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// ============================================================================
// SMTP CONFIGURATION ENDPOINTS (Admin only)
// ============================================================================

// Get SMTP config
router.get(
  '/smtp-config',
  authMiddleware,
  adminMiddleware,
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await db.query<SmtpConfig>('SELECT * FROM smtp_config LIMIT 1');

      if (result.rows.length === 0) {
        res.status(404).json({ detail: 'SMTP configuration not found' });
        return;
      }

      // Don't send password to client
      const config = { ...result.rows[0], auth_password: undefined };
      res.json(config);
    } catch (error) {
      console.error('Get SMTP config error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Create SMTP config
router.post(
  '/smtp-config',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as CreateSmtpConfigRequest;

      // Validate required fields
      if (!body.host || !body.port || !body.from_email) {
        res.status(400).json({ detail: 'Missing required fields' });
        return;
      }

      // Check if config already exists
      const existingResult = await db.query('SELECT id FROM smtp_config LIMIT 1');
      if (existingResult.rows.length > 0) {
        res.status(400).json({ detail: 'SMTP configuration already exists. Use PUT to update.' });
        return;
      }

      // Create SMTP config
      const result = await db.query<SmtpConfig>(
        `INSERT INTO smtp_config (
          host, port, secure, auth_user, auth_password, from_email, from_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          body.host,
          body.port,
          body.secure || false,
          body.auth_user || null,
          body.auth_password || null,
          body.from_email,
          body.from_name || 'StackRadar Alerts',
        ]
      );

      clearSmtpConfigCache();

      const config = { ...result.rows[0], auth_password: undefined };
      res.status(201).json(config);
    } catch (error) {
      console.error('Create SMTP config error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Update SMTP config
router.put(
  '/smtp-config',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as UpdateSmtpConfigRequest;

      // Get existing config
      const existingResult = await db.query<SmtpConfig>('SELECT * FROM smtp_config LIMIT 1');
      if (existingResult.rows.length === 0) {
        res.status(404).json({ detail: 'SMTP configuration not found. Use POST to create.' });
        return;
      }

      const existing = existingResult.rows[0];

      // Update SMTP config
      const result = await db.query<SmtpConfig>(
        `UPDATE smtp_config SET
          host = COALESCE($1, host),
          port = COALESCE($2, port),
          secure = COALESCE($3, secure),
          auth_user = COALESCE($4, auth_user),
          auth_password = COALESCE($5, auth_password),
          from_email = COALESCE($6, from_email),
          from_name = COALESCE($7, from_name),
          updated_at = NOW()
        WHERE id = $8
        RETURNING *`,
        [
          body.host,
          body.port,
          body.secure,
          body.auth_user,
          body.auth_password,
          body.from_email,
          body.from_name,
          existing.id,
        ]
      );

      clearSmtpConfigCache();

      const config = { ...result.rows[0], auth_password: undefined };
      res.json(config);
    } catch (error) {
      console.error('Update SMTP config error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }
);

// Test SMTP config
router.post(
  '/smtp-config/test',
  authMiddleware,
  adminMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { test_email } = req.body;

      if (!test_email) {
        res.status(400).json({ detail: 'test_email is required' });
        return;
      }

      await testSmtpConfig(test_email);

      res.json({ detail: 'Test email sent successfully' });
    } catch (error) {
      console.error('Test SMTP config error:', error);
      const message = error instanceof Error ? error.message : 'Failed to send test email';
      res.status(500).json({ detail: message });
    }
  }
);

// Trigger test alert for a specific channel
router.post(
  '/trigger-test',
  authMiddleware,
  editorMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { channel_id, site_id } = req.body;

      if (!channel_id || !site_id) {
        res.status(400).json({ detail: 'channel_id and site_id are required' });
        return;
      }

      const allowed = req.userTenantIds || [];

      // Check if site exists and user has access
      const siteResult = await db.query(
        'SELECT id, name FROM sites WHERE id = $1 AND tenant_id = ANY($2)',
        [site_id, allowed]
      );

      if (siteResult.rows.length === 0) {
        res.status(404).json({ detail: 'Site not found or access denied' });
        return;
      }

      const site = siteResult.rows[0];

      // Get the specific notification channel
      const channelResult = await db.query<NotificationChannel>(
        `SELECT nc.* FROM notification_channels nc
         INNER JOIN sites s ON nc.site_id = s.id
         WHERE nc.id = $1 AND nc.site_id = $2 AND s.tenant_id = ANY($3)`,
        [channel_id, site_id, allowed]
      );

      if (channelResult.rows.length === 0) {
        res.status(404).json({ detail: 'Notification channel not found or access denied' });
        return;
      }

      const channel = channelResult.rows[0];

      if (!channel.enabled) {
        res.status(400).json({ detail: 'Channel is disabled. Please enable it before testing.' });
        return;
      }

      // Create a test alert in history
      const alertResult = await db.query<AlertHistory>(
        `INSERT INTO alert_history (
          site_id, alert_rule_id, state, metric_value, threshold_value,
          message, triggered_at
        ) VALUES ($1, NULL, $2, $3, $4, $5, NOW())
        RETURNING *`,
        [
          site_id,
          'firing',
          95.0,
          80.0,
          `TEST ALERT: High CPU Usage on ${site.name} - This is a test alert for channel "${channel.name}"`
        ]
      );

      const alert = alertResult.rows[0];

      // Send notification to this specific channel directly
      const { sendEmail } = await import('../services/alerting/smtp.js');

      try {
        if (channel.channel_type === 'email') {
          // Send email notification
          const subject = `[StackRadar Test Alert] High CPU Usage on ${site.name}`;

          const { html: htmlBody, text: textBody } = renderTemplate('test-alert', {
            siteName: site.name,
            channelName: channel.name,
          });

          await sendEmail(channel.email_recipients!, subject, htmlBody, textBody);
        } else if (channel.channel_type === 'webhook') {
          // Send webhook notification
          const payload = {
            alert_type: 'test',
            site: site.name,
            metric: 'cpu_percent',
            current_value: 95.0,
            threshold: 80.0,
            severity: 'warning',
            message: `TEST ALERT: High CPU Usage on ${site.name}`,
            channel: channel.name,
            triggered_at: new Date().toISOString()
          };

          const url = new URL(channel.webhook_url!);
          const protocol = url.protocol === 'https:' ? https : http;
          const headers: any = {
            'Content-Type': 'application/json',
            'User-Agent': 'StackRadar-Alert-System'
          };

          if (channel.webhook_headers) {
            Object.assign(headers, channel.webhook_headers);
          }

          await new Promise<void>((resolve, reject) => {
            const req = protocol.request(url, {
              method: 'POST',
              headers
            }, (res) => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve();
              } else {
                reject(new Error(`Webhook returned status ${res.statusCode}`));
              }
            });

            req.on('error', reject);
            req.write(JSON.stringify(payload));
            req.end();
          });
        }

        // Mark notification as sent
        await db.query(
          'UPDATE alert_history SET notification_sent = TRUE WHERE id = $1',
          [alert.id]
        );

        res.json({
          message: `Test alert sent successfully to channel "${channel.name}"`,
          alert_name: 'Test Alert - High CPU Usage',
          severity: 'warning',
          channel_type: channel.channel_type,
          alert_id: alert.id
        });
      } catch (notifError) {
        // Mark notification as failed
        const errorMsg = notifError instanceof Error ? notifError.message : String(notifError);
        await db.query(
          'UPDATE alert_history SET notification_sent = FALSE, notification_error = $1 WHERE id = $2',
          [errorMsg, alert.id]
        );
        throw notifError;
      }
    } catch (error) {
      console.error('Trigger test alert error:', error);
      const message = error instanceof Error ? error.message : 'Failed to trigger test alert';
      res.status(500).json({ detail: message });
    }
  }
);

export default router;
