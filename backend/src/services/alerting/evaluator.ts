import db from '../../db/database.js';
import { sendNotifications } from './notifier.js';
import { AlertRule, K8sMetrics, MetricType } from '../../types/index.js';

/**
 * Main entry point - evaluate all enabled alert rules
 * Called by cron job every 5 minutes
 */
export async function evaluateAllAlerts(): Promise<void> {
  console.log('🔔 Starting alert evaluation...');

  try {
    // Get all enabled metric-based alert rules (uptime alerts are handled by the uptime checker)
    const result = await db.query<AlertRule>(
      `SELECT * FROM alert_rules WHERE enabled = TRUE AND alert_type = 'metric' ORDER BY site_id`
    );

    const rules = result.rows;
    console.log(`Found ${rules.length} enabled metric alert rules`);

    if (rules.length === 0) {
      return;
    }

    // Evaluate each rule
    let firedCount = 0;
    let resolvedCount = 0;
    let skippedCount = 0;

    for (const rule of rules) {
      try {
        const result = await evaluateRule(rule);
        if (result === 'fired') firedCount++;
        else if (result === 'resolved') resolvedCount++;
        else skippedCount++;
      } catch (error) {
        console.error(`Failed to evaluate rule ${rule.id} (${rule.name}):`, error);
      }
    }

    console.log(
      `✅ Alert evaluation complete: ${firedCount} fired, ${resolvedCount} resolved, ${skippedCount} skipped`
    );
  } catch (error) {
    console.error('❌ Alert evaluation failed:', error);
    throw error;
  }
}

/**
 * Evaluate a single alert rule
 * Returns: 'fired' | 'resolved' | 'skipped'
 */
export async function evaluateRule(rule: AlertRule): Promise<string> {
  // Skip non-metric alerts (uptime alerts are handled separately)
  if (rule.alert_type !== 'metric' || !rule.metric_type || !rule.threshold_operator || rule.threshold_value === null) {
    return 'skipped';
  }

  // Get current metric value
  const currentValue = await getCurrentMetricValue(
    rule.site_id,
    rule.metric_type,
    rule.time_window_minutes
  );

  if (currentValue === null) {
    // No metrics available, skip this rule
    return 'skipped';
  }

  // Check if condition is met
  const conditionMet = evaluateCondition(
    currentValue,
    rule.threshold_operator,
    rule.threshold_value
  );

  // Check for existing firing alert
  const existingAlert = await getLastFiringAlert(rule.id);

  if (conditionMet) {
    // Condition is met - should fire alert
    if (existingAlert) {
      // Check if we should send a recurring notification
      const lastNotified = existingAlert.last_notified_at 
        ? new Date(existingAlert.last_notified_at) 
        : new Date(existingAlert.triggered_at);
      
      const repeatIntervalMs = (rule.repeat_interval_hours || 1) * 60 * 60 * 1000;
      const nextNotificationTime = new Date(lastNotified.getTime() + repeatIntervalMs);

      if (Date.now() >= nextNotificationTime.getTime()) {
        console.log(`🔔 Sending recurring notification for alert ${rule.name} (still firing, interval: ${rule.repeat_interval_hours}h)`);
        
        // Update last_notified_at
        await updateAlertLastNotifiedAt(existingAlert.id);
        
        // Send notifications
        sendNotifications(existingAlert.id, rule.id).catch((error) => {
          console.error(`Failed to send recurring notifications for alert ${existingAlert.id}:`, error);
        });
        
        return 'fired'; // Or maybe 'skipped' but 'fired' indicates notification activity
      }

      // Alert already firing and notified recently, just skip
      console.log(`Alert ${rule.name} still firing (value: ${currentValue}), last notified ${lastNotified.toISOString()}`);
      return 'skipped';
    }

    // Fire new alert (no existing firing alert)
    const message = formatAlertMessage(rule, currentValue, 'firing');
    const alertHistoryId = await createAlertHistory(
      rule,
      currentValue,
      'firing',
      message
    );

    console.log(`🔔 Alert fired: ${rule.name} (${rule.metric_type} = ${currentValue})`);

    // Send notifications asynchronously
    sendNotifications(alertHistoryId, rule.id).catch((error) => {
      console.error(`Failed to send notifications for alert ${alertHistoryId}:`, error);
    });

    return 'fired';
  } else {
    // Condition not met - should resolve alert if one is firing
    if (existingAlert) {
      await resolveAlert(existingAlert.id);
      console.log(`✅ Alert resolved: ${rule.name} (${rule.metric_type} = ${currentValue})`);

      // Optionally send resolution notification
      const message = formatAlertMessage(rule, currentValue, 'resolved');
      const resolvedAlertId = await createAlertHistory(
        rule,
        currentValue,
        'resolved',
        message
      );

      sendNotifications(resolvedAlertId, rule.id).catch((error) => {
        console.error(`Failed to send resolution notifications:`, error);
      });

      return 'resolved';
    }

    return 'skipped';
  }
}

/**
 * Get current metric value for a site
 */
export async function getCurrentMetricValue(
  siteId: number,
  metricType: MetricType,
  timeWindowMinutes?: number
): Promise<number | null> {
  try {
    switch (metricType) {
      case 'cpu_percent':
      case 'memory_percent': {
        const result = await db.query<{ value: number }>(
          `SELECT ${metricType === 'cpu_percent' ? 'cpu_usage_percent' : 'memory_usage_percent'} as value
           FROM site_metrics
           WHERE site_id = $1`,
          [siteId]
        );
        return result.rows.length > 0 ? Number(result.rows[0].value) : null;
      }

      case 'error_logs': {
        const window = timeWindowMinutes || 5;
        const result = await db.query<{ count: string }>(
          `SELECT COUNT(*)::text as count
           FROM log_entries le
           LEFT JOIN systems sys ON sys.id = le.system_id
           LEFT JOIN environments e ON e.id = sys.environment_id
           WHERE e.site_id = $1
             AND le.level = 'ERROR'
             AND le.timestamp >= NOW() - INTERVAL '${window} minutes'`,
          [siteId]
        );
        return result.rows.length > 0 ? parseInt(result.rows[0].count) : 0;
      }

      case 'pod_failed':
      case 'pod_pending': {
        const field = metricType === 'pod_failed' ? 'pod_failed' : 'pod_pending';
        const result = await db.query<{ value: number }>(
          `SELECT ${field} as value FROM site_metrics WHERE site_id = $1`,
          [siteId]
        );
        return result.rows.length > 0 ? Number(result.rows[0].value) : null;
      }

      case 'deployment_readiness': {
        const result = await db.query<K8sMetrics>(
          `SELECT deployment_ready, deployment_count
           FROM site_metrics
           WHERE site_id = $1`,
          [siteId]
        );
        if (result.rows.length === 0 || result.rows[0].deployment_count === 0) {
          return null;
        }
        const ready = Number(result.rows[0].deployment_ready);
        const total = Number(result.rows[0].deployment_count);
        return total > 0 ? (ready / total) * 100 : null;
      }

      case 'pvc_bound': {
        const result = await db.query<K8sMetrics>(
          `SELECT pvc_bound, pvc_count
           FROM site_metrics
           WHERE site_id = $1`,
          [siteId]
        );
        if (result.rows.length === 0 || result.rows[0].pvc_count === 0) {
          return null;
        }
        const bound = Number(result.rows[0].pvc_bound);
        const total = Number(result.rows[0].pvc_count);
        return total > 0 ? (bound / total) * 100 : null;
      }

      case 'node_health': {
        const result = await db.query<K8sMetrics>(
          `SELECT node_ready, node_count
           FROM site_metrics
           WHERE site_id = $1`,
          [siteId]
        );
        if (result.rows.length === 0 || result.rows[0].node_count === 0) {
          return null;
        }
        const ready = Number(result.rows[0].node_ready);
        const total = Number(result.rows[0].node_count);
        return total > 0 ? (ready / total) * 100 : null;
      }

      default:
        console.warn(`Unknown metric type: ${metricType}`);
        return null;
    }
  } catch (error) {
    console.error(`Failed to get metric value for ${metricType}:`, error);
    return null;
  }
}

/**
 * Evaluate if condition is met
 */
function evaluateCondition(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '=':
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Get last firing alert for a rule
 */
async function getLastFiringAlert(
  ruleId: number
): Promise<{ id: number; triggered_at: Date; last_notified_at: Date | null } | null> {
  const result = await db.query<{ id: number; triggered_at: Date; last_notified_at: Date | null }>(
    `SELECT id, triggered_at, last_notified_at
     FROM alert_history
     WHERE alert_rule_id = $1 AND state = 'firing' AND resolved_at IS NULL
     ORDER BY triggered_at DESC
     LIMIT 1`,
    [ruleId]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Check if alert is in cooldown period
 */
export async function checkCooldown(
  ruleId: number,
  cooldownMinutes: number
): Promise<boolean> {
  const result = await db.query<{ triggered_at: Date }>(
    `SELECT triggered_at
     FROM alert_history
     WHERE alert_rule_id = $1 AND state = 'firing'
     ORDER BY triggered_at DESC
     LIMIT 1`,
    [ruleId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const lastTriggered = new Date(result.rows[0].triggered_at);
  const cooldownUntil = new Date(lastTriggered.getTime() + cooldownMinutes * 60 * 1000);
  const now = new Date();

  return now < cooldownUntil;
}

/**
 * Create alert history entry
 */
export async function createAlertHistory(
  rule: AlertRule,
  metricValue: number,
  state: 'firing' | 'resolved',
  message: string
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO alert_history (
      alert_rule_id, site_id, state, metric_value, threshold_value, message, last_notified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
    [rule.id, rule.site_id, state, metricValue, rule.threshold_value, message, state === 'firing' ? new Date() : null]
  );

  return result.rows[0].id;
}

/**
 * Update the last_notified_at timestamp for an alert
 */
async function updateAlertLastNotifiedAt(alertHistoryId: number): Promise<void> {
  await db.query(
    `UPDATE alert_history
     SET last_notified_at = NOW()
     WHERE id = $1`,
    [alertHistoryId]
  );
}

/**
 * Resolve a firing alert
 */
export async function resolveAlert(alertHistoryId: number): Promise<void> {
  await db.query(
    `UPDATE alert_history
     SET state = 'resolved', resolved_at = NOW()
     WHERE id = $1`,
    [alertHistoryId]
  );
}

/**
 * Format alert message
 */
function formatAlertMessage(
  rule: AlertRule,
  value: number,
  state: 'firing' | 'resolved'
): string {
  const metricLabels: Record<string, string> = {
    cpu_percent: 'CPU usage',
    memory_percent: 'Memory usage',
    error_logs: 'Error log count',
    pod_failed: 'Failed pods',
    pod_pending: 'Pending pods',
    deployment_readiness: 'Deployment readiness',
    pvc_bound: 'PVC bound percentage',
    node_health: 'Node health percentage',
  };

  const metricType = rule.metric_type || 'unknown';
  const metricLabel = metricLabels[metricType] || metricType;
  const valueStr = ['deployment_readiness', 'pvc_bound', 'node_health'].includes(metricType)
    ? `${value.toFixed(1)}%`
    : value.toString();

  if (state === 'firing') {
    return `${metricLabel} is ${valueStr}, which ${getOperatorText(rule.threshold_operator || '>')} threshold of ${rule.threshold_value}`;
  } else {
    return `${metricLabel} has returned to normal (${valueStr})`;
  }
}

/**
 * Get human-readable operator text
 */
function getOperatorText(operator: string): string {
  const texts: Record<string, string> = {
    '>': 'exceeds',
    '>=': 'meets or exceeds',
    '<': 'is below',
    '<=': 'is at or below',
    '=': 'equals',
  };
  return texts[operator] || operator;
}
