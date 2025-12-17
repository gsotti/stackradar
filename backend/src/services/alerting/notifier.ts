import https from 'https';
import http from 'http';
import db from '../../db/database.js';
import { sendEmail } from './smtp.js';
import {
  AlertHistory,
  AlertRule,
  NotificationChannel,
  System,
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

    // Get system details
    const systemResult = await db.query<System>(
      'SELECT * FROM systems WHERE id = $1',
      [alert.system_id]
    );

    if (systemResult.rows.length === 0) {
      console.error('System not found:', alert.system_id);
      return;
    }

    const system = systemResult.rows[0];

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
          await sendEmailNotification(channel, alert, rule, system);
        } else if (channel.channel_type === 'webhook') {
          await sendWebhookNotification(channel, alert, rule, system);
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
  system: System
): Promise<void> {
  if (!channel.email_recipients || channel.email_recipients.length === 0) {
    throw new Error('No email recipients configured');
  }

  const subject = formatEmailSubject(alert, rule, system);
  const htmlBody = formatEmailTemplate(alert, rule, system);
  const textBody = formatTextTemplate(alert, rule, system);

  await sendEmail(channel.email_recipients, subject, htmlBody, textBody);
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(
  channel: NotificationChannel,
  alert: AlertHistory,
  rule: AlertRule,
  system: System
): Promise<void> {
  if (!channel.webhook_url) {
    throw new Error('No webhook URL configured');
  }

  const payload = formatWebhookPayload(alert, rule, system);
  const method = channel.webhook_method || 'POST';

  await sendHttpRequest(
    channel.webhook_url,
    method,
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
  system: System
): string {
  const severity = rule.severity.toUpperCase();
  const state = alert.state === 'firing' ? 'ALERT' : 'RESOLVED';
  return `[LogRadar ${severity}] ${state}: ${rule.name} - ${system.name}`;
}

/**
 * Format HTML email template
 */
function formatEmailTemplate(
  alert: AlertHistory,
  rule: AlertRule,
  system: System
): string {
  const metricTypeLabel = getMetricTypeLabel(rule.metric_type);
  const stateColor = alert.state === 'firing' ? '#ef4444' : '#10b981';
  const severityColor =
    rule.severity === 'critical'
      ? '#dc2626'
      : rule.severity === 'warning'
      ? '#f59e0b'
      : '#3b82f6';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${stateColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; color: #6b7280; }
    .value { color: #111827; }
    .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; color: white; background: ${severityColor}; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${alert.state === 'firing' ? '⚠️ Alert Triggered' : '✅ Alert Resolved'}</h1>
    </div>
    <div class="content">
      <div class="field">
        <span class="label">System:</span>
        <span class="value">${system.name}</span>
      </div>
      <div class="field">
        <span class="label">Alert Rule:</span>
        <span class="value">${rule.name}</span>
      </div>
      ${rule.description ? `<div class="field"><span class="label">Description:</span><span class="value">${rule.description}</span></div>` : ''}
      <div class="field">
        <span class="label">Severity:</span>
        <span class="severity">${rule.severity.toUpperCase()}</span>
      </div>
      <div class="field">
        <span class="label">Status:</span>
        <span class="value">${alert.state === 'firing' ? 'FIRING' : 'RESOLVED'}</span>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <div class="field">
        <span class="label">Metric:</span>
        <span class="value">${metricTypeLabel}</span>
      </div>
      <div class="field">
        <span class="label">Condition:</span>
        <span class="value">${metricTypeLabel} ${rule.threshold_operator} ${rule.threshold_value}</span>
      </div>
      <div class="field">
        <span class="label">Current Value:</span>
        <span class="value" style="font-weight: bold; color: ${alert.state === 'firing' ? '#ef4444' : '#10b981'};">${alert.metric_value !== null ? alert.metric_value : 'N/A'}</span>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <div class="field">
        <span class="label">Triggered At:</span>
        <span class="value">${new Date(alert.triggered_at).toLocaleString()}</span>
      </div>
      ${alert.resolved_at ? `<div class="field"><span class="label">Resolved At:</span><span class="value">${new Date(alert.resolved_at).toLocaleString()}</span></div>` : ''}
    </div>
    <div class="footer">
      <p>This is an automated message from LogRadar</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Format plain text email template
 */
function formatTextTemplate(
  alert: AlertHistory,
  rule: AlertRule,
  system: System
): string {
  const metricTypeLabel = getMetricTypeLabel(rule.metric_type);

  return `
LogRadar Alert Notification
${alert.state === 'firing' ? 'ALERT TRIGGERED' : 'ALERT RESOLVED'}
${'='.repeat(50)}

System: ${system.name}
Alert Rule: ${rule.name}
${rule.description ? `Description: ${rule.description}` : ''}
Severity: ${rule.severity.toUpperCase()}
Status: ${alert.state === 'firing' ? 'FIRING' : 'RESOLVED'}

Metric Details:
- Metric: ${metricTypeLabel}
- Condition: ${metricTypeLabel} ${rule.threshold_operator} ${rule.threshold_value}
- Current Value: ${alert.metric_value !== null ? alert.metric_value : 'N/A'}

Timestamps:
- Triggered At: ${new Date(alert.triggered_at).toLocaleString()}
${alert.resolved_at ? `- Resolved At: ${new Date(alert.resolved_at).toLocaleString()}` : ''}

${'='.repeat(50)}
This is an automated message from LogRadar
  `.trim();
}

/**
 * Format webhook payload
 */
function formatWebhookPayload(
  alert: AlertHistory,
  rule: AlertRule,
  system: System
): Record<string, any> {
  return {
    alert_id: alert.id,
    system_id: system.id,
    system_name: system.name,
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
        'User-Agent': 'LogRadar-Alerting/1.0',
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
function getMetricTypeLabel(metricType: string): string {
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
