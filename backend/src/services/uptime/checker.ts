import https from 'https';
import http from 'http';
import db from '../../db/database.js';
import { resolveHierarchy } from '../hierarchy.js';
import { UptimeMonitor, UptimeStatus, NotificationChannel } from '../../types/index.js';
import { sendEmail } from '../alerting/smtp.js';
import { renderTemplate } from '../email/templateRenderer.js';
import { notificationDispatcher } from './notificationDispatcher.js';

interface CheckResult {
  status: UptimeStatus;
  responseTimeMs: number;
  statusCode: number | null;
  errorMessage: string | null;
}

// DNS errors that are transient and worth retrying
const RETRYABLE_DNS_CODES = new Set(['EAI_AGAIN', 'EAI_NODATA', 'ETIMEOUT', 'ECONNRESET']);
const DNS_RETRY_MIN_MS = 1000;
const DNS_RETRY_MAX_MS = 3000;

/**
 * Execute a single HTTP request for a monitor
 */
function executeHttpRequest(monitor: UptimeMonitor): Promise<{ statusCode: number }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(monitor.url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const timeout = Math.min(monitor.timeout_ms || 10000, 30000);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: monitor.method,
      timeout,
      headers: {
        'User-Agent': 'StackRadar-UptimeMonitor/1.0',
      },
    };

    const req = protocol.request(options, (res) => {
      res.resume();
      resolve({ statusCode: res.statusCode || 0 });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}

/**
 * Perform HTTP check for a monitor, with one automatic retry on transient DNS failures.
 */
async function performHttpCheck(monitor: UptimeMonitor): Promise<CheckResult> {
  const start = Date.now();
  let status: UptimeStatus = 'down';
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    let result: { statusCode: number };
    try {
      result = await executeHttpRequest(monitor);
    } catch (err: any) {
      // Retry once on transient DNS errors
      if (err?.code && RETRYABLE_DNS_CODES.has(err.code)) {
        const retryDelay = DNS_RETRY_MIN_MS + Math.floor(Math.random() * (DNS_RETRY_MAX_MS - DNS_RETRY_MIN_MS));
        console.log(`[Uptime] DNS error ${err.code} for "${monitor.name}", retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        result = await executeHttpRequest(monitor);
      } else {
        throw err;
      }
    }

    statusCode = result.statusCode;

    if (statusCode === monitor.expected_status) {
      status = 'up';
    } else {
      status = 'degraded';
      errorMessage = `Expected status ${monitor.expected_status}, got ${statusCode}`;
    }
  } catch (error: any) {
    errorMessage = error instanceof Error ? error.message : String(error);
    status = 'down';
  }

  const responseTimeMs = Date.now() - start;

  return { status, responseTimeMs, statusCode, errorMessage };
}

/**
 * Save check result to database
 */
async function saveCheck(
  monitorId: number,
  status: UptimeStatus,
  responseTimeMs: number,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  await db.query(
    `INSERT INTO uptime_checks (monitor_id, status, response_time_ms, status_code, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [monitorId, status, responseTimeMs, statusCode, errorMessage]
  );
}

/**
 * Update monitor status and consecutive failures
 */
export async function updateMonitorStatus(
  monitorId: number,
  updates: {
    current_status?: UptimeStatus;
    consecutive_failures?: number;
    last_status_change?: Date;
    last_checked_at?: Date;
  }
): Promise<void> {
  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.current_status !== undefined) {
    setClauses.push(`current_status = $${paramIndex++}`);
    values.push(updates.current_status);
  }
  if (updates.consecutive_failures !== undefined) {
    setClauses.push(`consecutive_failures = $${paramIndex++}`);
    values.push(updates.consecutive_failures);
  }
  if (updates.last_status_change !== undefined) {
    setClauses.push(`last_status_change = $${paramIndex++}`);
    values.push(updates.last_status_change);
  }
  if (updates.last_checked_at !== undefined) {
    setClauses.push(`last_checked_at = $${paramIndex++}`);
    values.push(updates.last_checked_at);
  }

  values.push(monitorId);

  await db.query(
    `UPDATE uptime_monitors SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}

/**
 * Send notification for monitor status change
 */
async function sendUptimeNotification(
  monitor: UptimeMonitor,
  eventType: 'down' | 'recovered',
  triggerReason?: string,
  isRecurring?: boolean,
  consecutiveFailures?: number
): Promise<void> {
  console.log(`[Uptime Alert] Sending ${eventType} notification for monitor "${monitor.name}" (ID: ${monitor.id})`);

  const now = new Date();

  try {
    // Get site details including org_id via the tenant
    const siteResult = await db.query<{ id: number; name: string; tenant_id: number; organization_id: number | null }>(
      `SELECT s.id, s.name, s.tenant_id, t.organization_id
       FROM sites s
       JOIN tenants t ON t.id = s.tenant_id
       WHERE s.id = $1`,
      [monitor.site_id]
    );

    if (siteResult.rows.length === 0) {
      console.error('[Uptime Alert] Site not found for uptime notification:', monitor.site_id);
      return;
    }

    const site = siteResult.rows[0];

    // Log the trigger to the central logs
    try {
      const client = await db.connect();
      try {
        const { systemId } = await resolveHierarchy(
          client,
          site.id,
          'uptime',
          'monitor'
        );

        const logMessage = triggerReason || `Monitor "${monitor.name}" ${eventType === 'down' ? 'is DOWN' : 'has RECOVERED'} (${monitor.url})`;

        await client.query(
          `INSERT INTO log_entries (
            system_id, timestamp, level, message, source,
            tenant_id, site, environment, system
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            systemId,
            now,
            eventType === 'down' ? 'CRITICAL' : 'INFO',
            logMessage,
            'uptime-monitor',
            site.tenant_id,
            site.name,
            'uptime',
            'monitor'
          ]
        );
      } finally {
        client.release();
      }
    } catch (logError) {
      console.error('[Uptime Alert] Failed to log status change:', logError);
    }

    // Check if there's an uptime alert rule for this monitor
    const alertRuleResult = await db.query<{ id: number; severity: string; failure_threshold: number }>(
      `SELECT id, severity, failure_threshold FROM alert_rules
       WHERE monitor_id = $1 AND alert_type = 'uptime' AND enabled = TRUE`,
      [monitor.id]
    );

    let channels: NotificationChannel[] = [];

    if (alertRuleResult.rows.length > 0) {
      // Use channels linked to the alert rule
      const ruleId = alertRuleResult.rows[0].id;
      console.log(`[Uptime Alert] Found alert rule ID: ${ruleId}`);

      const channelsResult = await db.query<NotificationChannel>(
        `SELECT nc.* FROM notification_channels nc
         INNER JOIN alert_rule_channels arc ON nc.id = arc.notification_channel_id
         WHERE arc.alert_rule_id = $1 AND nc.enabled = TRUE`,
        [ruleId]
      );
      channels = channelsResult.rows;

      // If alert rule has no linked channels, fall back to site channels
      if (channels.length === 0) {
        console.log(`[Uptime Alert] No channels linked to alert rule, falling back to site channels`);
        const siteChannelsResult = await db.query<NotificationChannel>(
          'SELECT * FROM notification_channels WHERE site_id = $1 AND enabled = TRUE',
          [monitor.site_id]
        );
        channels = siteChannelsResult.rows;
      }
    } else {
      // No alert rule: get all notification channels for this site
      console.log(`[Uptime Alert] No alert rule found, using site channels`);
      const channelsResult = await db.query<NotificationChannel>(
        'SELECT * FROM notification_channels WHERE site_id = $1 AND enabled = TRUE',
        [monitor.site_id]
      );
      channels = channelsResult.rows;
    }

    console.log(`[Uptime Alert] Found ${channels.length} notification channel(s)`);

    // Create alert history entry if there's an alert rule
    const alertRule = alertRuleResult.rows[0];
    if (alertRule) {
      const state = eventType === 'down' ? 'firing' : 'resolved';
      const message = triggerReason || (eventType === 'down'
        ? `Monitor "${monitor.name}" is DOWN (${monitor.url})`
        : `Monitor "${monitor.name}" has RECOVERED (${monitor.url})`);

      await db.query(
        `INSERT INTO alert_history (alert_rule_id, site_id, state, message, notification_sent, last_notified_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [alertRule.id, monitor.site_id, state, message, channels.length > 0, state === 'firing' ? now : null]
      );
    }

    if (channels.length === 0) {
      console.log(`[Uptime Alert] No enabled notification channels found for site ID: ${monitor.site_id}. Alert will not be sent.`);
      return;
    }

    // Generate subject based on event type and recurring status
    let subject: string;
    if (eventType === 'recovered') {
      subject = `[StackRadar RESOLVED] Monitor Recovered: ${monitor.name} - ${site.name}`;
    } else if (isRecurring) {
      subject = `[StackRadar REMINDER] Monitor Still Down: ${monitor.name} - ${site.name}`;
    } else {
      subject = `[StackRadar ALERT] Monitor Down: ${monitor.name} - ${site.name}`;
    }

    const timestamp = new Date().toLocaleString();
    const failureCount = consecutiveFailures !== undefined ? String(consecutiveFailures) : String(monitor.consecutive_failures);

    // Select appropriate template based on event type and recurring status
    let htmlBody: string;
    let textBody: string;

    if (eventType === 'down' && isRecurring) {
      const rendered = renderTemplate('uptime-still-down', {
        siteName: site.name,
        monitorName: monitor.name,
        monitorUrl: monitor.url,
        timestamp,
        consecutiveFailures: failureCount,
      });
      htmlBody = rendered.html;
      textBody = rendered.text;
    } else if (eventType === 'down') {
      const rendered = renderTemplate('uptime-down', {
        siteName: site.name,
        monitorName: monitor.name,
        monitorUrl: monitor.url,
        timestamp,
        consecutiveFailures: failureCount,
      });
      htmlBody = rendered.html;
      textBody = rendered.text;
    } else {
      const rendered = renderTemplate('uptime-recovered', {
        siteName: site.name,
        monitorName: monitor.name,
        monitorUrl: monitor.url,
        timestamp,
      });
      htmlBody = rendered.html;
      textBody = rendered.text;
    }

    // Send to all channels
    for (const channel of channels) {
      try {
        if (channel.channel_type === 'email' && channel.email_recipients?.length) {
          await sendEmail(channel.email_recipients, subject, htmlBody, textBody, site.organization_id);
        } else if (channel.channel_type === 'webhook' && channel.webhook_url) {
          await sendWebhookNotification(channel, monitor, site, eventType);
        }
      } catch (error) {
        console.error(`Failed to send uptime notification via ${channel.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to send uptime notification:', error);
  }
}

/**
 * Send webhook notification for uptime event
 */
async function sendWebhookNotification(
  channel: NotificationChannel,
  monitor: UptimeMonitor,
  site: { id: number; name: string },
  eventType: 'down' | 'recovered'
): Promise<void> {
  if (!channel.webhook_url) return;

  const payload = {
    event_type: eventType === 'down' ? 'monitor_down' : 'monitor_recovered',
    monitor_id: monitor.id,
    monitor_name: monitor.name,
    monitor_url: monitor.url,
    site_id: site.id,
    site_name: site.name,
    current_status: monitor.current_status,
    consecutive_failures: monitor.consecutive_failures,
    timestamp: new Date().toISOString(),
  };

  const data = JSON.stringify(payload);
  const urlObj = new URL(channel.webhook_url);

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'User-Agent': 'StackRadar-UptimeMonitor/1.0',
      ...(channel.webhook_headers || {}),
    },
    timeout: 5000,
  };

  const protocol = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = protocol.request(options, (res) => {
      res.resume();
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Webhook failed with status ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Webhook timed out'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Process a single monitor check
 */
export async function processMonitorCheck(monitor: UptimeMonitor): Promise<void> {
  const result = await performHttpCheck(monitor);

  // Save the check result
  await saveCheck(
    monitor.id,
    result.status,
    result.responseTimeMs,
    result.statusCode,
    result.errorMessage
  );

  // Get failure threshold: prefer alert rule, fall back to monitor, default to 3
  const alertRuleResult = await db.query<{ failure_threshold: number }>(
    `SELECT failure_threshold FROM alert_rules
     WHERE monitor_id = $1 AND alert_type = 'uptime' AND enabled = TRUE
     LIMIT 1`,
    [monitor.id]
  );
  const failureThreshold = alertRuleResult.rows[0]?.failure_threshold || monitor.failure_threshold || 3;

  const now = new Date();

  if (result.status === 'up') {
    // If previously failing, this is a recovery
    if (monitor.consecutive_failures > 0) {
      console.log(`[Uptime] Monitor "${monitor.name}" RECOVERED (status: ${result.statusCode}, time: ${result.responseTimeMs}ms)`);
      await updateMonitorStatus(monitor.id, {
        consecutive_failures: 0,
        current_status: 'up',
        last_status_change: now,
        last_checked_at: now,
      });

      // Fire-and-forget recovery notification
      notificationDispatcher.enqueue(() => sendUptimeNotification(monitor, 'recovered'));
    } else {
      await updateMonitorStatus(monitor.id, {
        current_status: 'up',
        last_checked_at: now,
      });
    }
  } else {
    // Increment consecutive failures
    const newFailures = monitor.consecutive_failures + 1;
    const hadAlreadyReachedThreshold = monitor.consecutive_failures >= failureThreshold;

    console.log(`[Uptime] Monitor "${monitor.name}" check FAILED: ${result.status} (failures: ${newFailures}/${failureThreshold}, code: ${result.statusCode}, error: ${result.errorMessage || 'none'}, time: ${result.responseTimeMs}ms)`);

    await updateMonitorStatus(monitor.id, {
      consecutive_failures: newFailures,
      current_status: result.status,
      last_checked_at: now,
    });

    // Only notify when threshold is first reached
    if (newFailures >= failureThreshold && !hadAlreadyReachedThreshold) {
      const reason = result.status === 'down'
        ? `Status code ${result.statusCode} (expected ${monitor.expected_status})`
        : result.errorMessage || 'Unknown error';

      const triggerMessage = `Monitor "${monitor.name}" is DOWN: Reached threshold of ${failureThreshold} failures. Last reason: ${reason}`;
      console.log(`[Uptime] ALERT TRIGGERED for monitor "${monitor.name}": ${triggerMessage}`);

      await updateMonitorStatus(monitor.id, {
        last_status_change: now
      });
      notificationDispatcher.enqueue(() => sendUptimeNotification(monitor, 'down', triggerMessage, false, newFailures));
    } else if (hadAlreadyReachedThreshold) {
      console.log(`[Uptime] Monitor "${monitor.name}" still down, checking for recurring notification`);

      // First, get the alert rule for THIS specific monitor
      const monitorAlertRuleResult = await db.query<{ id: number; repeat_interval_hours: number }>(
        `SELECT id, repeat_interval_hours FROM alert_rules
         WHERE monitor_id = $1 AND alert_type = 'uptime' AND enabled = TRUE
         LIMIT 1`,
        [monitor.id]
      );

      // Only proceed with recurring notification check if this monitor has an alert rule
      if (monitorAlertRuleResult.rows.length > 0) {
        const monitorAlertRule = monitorAlertRuleResult.rows[0];

        // Check for recurring notification - filter by THIS monitor's alert rule ID
        const lastAlertResult = await db.query<{ id: number; last_notified_at: Date; triggered_at: Date }>(
          `SELECT h.id, h.last_notified_at, h.triggered_at
           FROM alert_history h
           WHERE h.alert_rule_id = $1 AND h.state = 'firing' AND h.resolved_at IS NULL
           ORDER BY h.triggered_at DESC
           LIMIT 1`,
          [monitorAlertRule.id]
        );

        if (lastAlertResult.rows.length > 0) {
          const lastAlert = lastAlertResult.rows[0];

          // Atomic update: only proceed if enough time has passed
          const atomicResult = await db.query(
            `UPDATE alert_history SET last_notified_at = NOW()
             WHERE id = $1 AND (last_notified_at IS NULL OR last_notified_at <= NOW() - $2 * INTERVAL '1 hour')
             RETURNING id`,
            [lastAlert.id, monitorAlertRule.repeat_interval_hours || 1]
          );

          if (atomicResult.rowCount && atomicResult.rowCount > 0) {
            console.log(`🔔 Sending recurring notification for uptime alert "${monitor.name}" (still firing, interval: ${monitorAlertRule.repeat_interval_hours}h)`);
            const capturedLastNotifiedAt = lastAlert.last_notified_at;
            const capturedAlertId = lastAlert.id;
            notificationDispatcher.enqueue(async () => {
              try {
                await sendUptimeNotification(monitor, 'down', `Monitor "${monitor.name}" is STILL DOWN (persistent failure)`, true, newFailures);
              } catch (notifError) {
                // Revert last_notified_at so the notification will be retried next cycle
                await db.query(
                  'UPDATE alert_history SET last_notified_at = $1 WHERE id = $2',
                  [capturedLastNotifiedAt, capturedAlertId]
                );
                console.error(`[Uptime] Failed to send recurring notification, reverted last_notified_at:`, notifError);
              }
            });
          }
        }
      }
    }
  }
}

/**
 * Manually trigger a check for a specific monitor
 */
export async function triggerManualCheck(monitorId: number): Promise<{
  status: UptimeStatus;
  responseTimeMs: number;
  statusCode: number | null;
  errorMessage: string | null;
}> {
  const monitorResult = await db.query<UptimeMonitor>(
    'SELECT * FROM uptime_monitors WHERE id = $1',
    [monitorId]
  );

  if (monitorResult.rows.length === 0) {
    throw new Error('Monitor not found');
  }

  const monitor = monitorResult.rows[0];
  const result = await performHttpCheck(monitor);

  // Save the check but don't update failure tracking for manual checks
  await saveCheck(
    monitor.id,
    result.status,
    result.responseTimeMs,
    result.statusCode,
    result.errorMessage
  );

  // Update last_checked_at
  await updateMonitorStatus(monitor.id, {
    last_checked_at: new Date(),
  });

  return result;
}
