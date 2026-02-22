import https from 'https';
import http from 'http';
import db from '../../db/database.js';
import { sendEmail } from './smtp.js';
import { renderTemplate } from '../email/templateRenderer.js';
import {
  AlertHistory,
  AlertRule,
  NotificationChannel,
} from '../../types/index.js';

/**
 * Send notifications for a triggered alert
 */
export async function sendNotifications(
  alertHistoryId: number,
  ruleId: number
): Promise<void> {
  try {
    // Get alert history details
    const historyResult = await db.query<AlertHistory>(
      'SELECT * FROM alert_history WHERE id = $1',
      [alertHistoryId]
    );

    if (historyResult.rows.length === 0) {
      console.error('Alert history not found:', alertHistoryId);
      return;
    }

    const alert = historyResult.rows[0];

    // Get alert rule details
    const ruleResult = await db.query<AlertRule>(
      'SELECT * FROM alert_rules WHERE id = $1',
      [ruleId]
    );

    if (ruleResult.rows.length === 0) {
      console.error('Alert rule not found:', ruleId);
      return;
    }

    const rule = ruleResult.rows[0];

    // Get site details including org_id via the tenant
    const siteResult = await db.query<{ id: number; name: string; organization_id: number | null }>(
      `SELECT s.id, s.name, t.organization_id
       FROM sites s
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.id = $1`,
      [alert.site_id]
    );

    if (siteResult.rows.length === 0) {
      console.error('Site not found:', alert.site_id);
      return;
    }

    const site = siteResult.rows[0];

    // Get notification channels for this rule
    const channelsResult = await db.query<NotificationChannel>(
      `SELECT nc.* FROM notification_channels nc
       INNER JOIN alert_rule_channels arc ON nc.id = arc.notification_channel_id
       WHERE arc.alert_rule_id = $1 AND nc.enabled = TRUE`,
      [ruleId]
    );

    const channels = channelsResult.rows;

    if (channels.length === 0) {
      console.log('No enabled notification channels for rule:', ruleId);
      await markNotificationSent(alertHistoryId, true);
      return;
    }

    // Send notifications to each channel
    const errors: string[] = [];
    for (const channel of channels) {
      try {
        if (channel.channel_type === 'email') {
          await sendEmailNotification(channel, alert, rule, site, site.organization_id);
        } else if (channel.channel_type === 'webhook') {
          await sendWebhookNotification(channel, alert, rule, site);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${channel.name}: ${errorMsg}`);
        console.error(`Failed to send notification via ${channel.name}:`, error);
      }
    }

    // Update notification status
    if (errors.length > 0) {
      await markNotificationFailed(alertHistoryId, errors.join('; '));
    } else {
      await markNotificationSent(alertHistoryId, true);
    }
  } catch (error) {
    console.error('Failed to send notifications:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    await markNotificationFailed(alertHistoryId, errorMsg);
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  channel: NotificationChannel,
  alert: AlertHistory,
  rule: AlertRule,
  site: { id: number; name: string },
  organizationId?: number | null
): Promise<void> {
  if (!channel.email_recipients || channel.email_recipients.length === 0) {
    throw new Error('No email recipients configured');
  }

  const subject = formatEmailSubject(alert, rule, site);

  // Pre-compute all variables for template
  const metricTypeLabel = getMetricTypeLabel(rule.metric_type);
  const stateColor = alert.state === 'firing' ? '#ef4444' : '#10b981';
  const severityColor = rule.severity === 'critical' ? '#dc2626' : rule.severity === 'warning' ? '#f59e0b' : '#3b82f6';

  // Escape HTML in user-controlled fields to prevent XSS
  const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const { html: htmlBody, text: textBody } = renderTemplate('metric-alert', {
    stateColor,
    severityColor,
    headerText: alert.state === 'firing' ? '⚠️ Alert Triggered' : '✅ Alert Resolved',
    siteName: escapeHtml(site.name),
    ruleName: escapeHtml(rule.name),
    descriptionHtml: rule.description ? `<div class="field"><span class="label">Description:</span><span class="value">${escapeHtml(rule.description)}</span></div>` : '',
    severityUpper: rule.severity.toUpperCase(),
    statusText: alert.state === 'firing' ? 'FIRING' : 'RESOLVED',
    metricTypeLabel,
    conditionText: `${metricTypeLabel} ${rule.threshold_operator} ${rule.threshold_value}`,
    metricValue: alert.metric_value !== null ? String(alert.metric_value) : 'N/A',
    metricValueColor: alert.state === 'firing' ? '#ef4444' : '#10b981',
    triggeredAt: new Date(alert.triggered_at).toLocaleString(),
    resolvedAtHtml: alert.resolved_at ? `<div class="field"><span class="label">Resolved At:</span><span class="value">${new Date(alert.resolved_at).toLocaleString()}</span></div>` : '',
  });

  await sendEmail(channel.email_recipients, subject, htmlBody, textBody, organizationId);
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(
  channel: NotificationChannel,
  alert: AlertHistory,
  rule: AlertRule,
  site: { id: number; name: string }
): Promise<void> {
  if (!channel.webhook_url) {
    throw new Error('No webhook URL configured');
  }

  const payload = formatWebhookPayload(alert, rule, site);

  await sendHttpRequest(
    channel.webhook_url,
    'POST',
    payload,
    channel.webhook_headers || {}
  );
}

/**
 * Format email subject
 */
function formatEmailSubject(
  alert: AlertHistory,
  rule: AlertRule,
  site: { id: number; name: string }
): string {
  const severity = rule.severity.toUpperCase();
  const state = alert.state === 'firing' ? 'ALERT' : 'RESOLVED';
  return `[StackRadar ${severity}] ${state}: ${rule.name} - ${site.name}`;
}


/**
 * Format webhook payload
 */
function formatWebhookPayload(
  alert: AlertHistory,
  rule: AlertRule,
  site: { id: number; name: string }
): Record<string, any> {
  return {
    alert_id: alert.id,
    site_id: site.id,
    site_name: site.name,
    rule_id: rule.id,
    rule_name: rule.name,
    rule_description: rule.description,
    severity: rule.severity,
    state: alert.state,
    metric_type: rule.metric_type,
    metric_value: alert.metric_value,
    threshold_value: alert.threshold_value,
    threshold_operator: rule.threshold_operator,
    triggered_at: alert.triggered_at,
    resolved_at: alert.resolved_at,
    message: alert.message,
  };
}

/**
 * Send HTTP request for webhook
 */
function sendHttpRequest(
  url: string,
  method: string,
  payload: Record<string, any>,
  headers: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(payload);

    console.log('Sending webhook request:', method, url, data);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'StackRadar-Alerting/1.0',
        ...headers,
      },
      timeout: 5000, // 5 second timeout
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(
            new Error(
              `Webhook request failed with status ${res.statusCode}: ${body}`
            )
          );
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Webhook request timed out'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Get human-readable label for metric type
 */
function getMetricTypeLabel(metricType: string | null): string {
  if (!metricType) return 'N/A';
  const labels: Record<string, string> = {
    cpu_percent: 'CPU Usage',
    memory_percent: 'Memory Usage',
    error_logs: 'Error Log Count',
    pod_failed: 'Failed Pods',
    pod_pending: 'Pending Pods',
    deployment_readiness: 'Deployment Readiness',
    pvc_bound: 'PVC Bound Status',
    node_health: 'Node Health',
  };
  return labels[metricType] || metricType;
}

/**
 * Mark notification as sent
 */
async function markNotificationSent(
  alertHistoryId: number,
  sent: boolean
): Promise<void> {
  await db.query(
    'UPDATE alert_history SET notification_sent = $1, notification_error = NULL WHERE id = $2',
    [sent, alertHistoryId]
  );
}

/**
 * Mark notification as failed
 */
async function markNotificationFailed(
  alertHistoryId: number,
  error: string
): Promise<void> {
  await db.query(
    'UPDATE alert_history SET notification_sent = FALSE, notification_error = $1 WHERE id = $2',
    [error, alertHistoryId]
  );
}
