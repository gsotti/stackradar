-- Migration 15: Create Alerting System
-- Creates tables for monitoring rules, notifications, and alert history

-- Alert Rules: Define monitoring thresholds for systems
CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  system_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metric_type VARCHAR(50) NOT NULL,
  threshold_operator VARCHAR(10) NOT NULL,
  threshold_value NUMERIC(10,2) NOT NULL,
  time_window_minutes INTEGER DEFAULT 5,
  severity VARCHAR(20) DEFAULT 'warning',
  enabled BOOLEAN DEFAULT TRUE,
  cooldown_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT valid_metric_type CHECK (metric_type IN (
    'cpu_percent', 'memory_percent', 'error_logs',
    'pod_failed', 'pod_pending', 'deployment_readiness',
    'pvc_bound', 'node_health'
  )),
  CONSTRAINT valid_operator CHECK (threshold_operator IN ('>', '>=', '<', '<=', '='))
);

CREATE INDEX idx_alert_rules_system_id ON alert_rules(system_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_system_enabled ON alert_rules(system_id, enabled) WHERE enabled = TRUE;

-- Notification Channels: Email and webhook configurations
CREATE TABLE IF NOT EXISTS notification_channels (
  id SERIAL PRIMARY KEY,
  system_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,

  -- Email configuration (used when channel_type = 'email')
  email_recipients TEXT[],

  -- Webhook configuration (used when channel_type = 'webhook')
  webhook_url TEXT,
  webhook_method VARCHAR(10) DEFAULT 'POST',
  webhook_headers JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
  CONSTRAINT valid_channel_type CHECK (channel_type IN ('email', 'webhook')),
  CONSTRAINT email_recipients_required CHECK (
    (channel_type = 'email' AND email_recipients IS NOT NULL AND array_length(email_recipients, 1) > 0) OR
    channel_type != 'email'
  ),
  CONSTRAINT webhook_url_required CHECK (
    (channel_type = 'webhook' AND webhook_url IS NOT NULL) OR
    channel_type != 'webhook'
  )
);

CREATE INDEX idx_notification_channels_system_id ON notification_channels(system_id);
CREATE INDEX idx_notification_channels_enabled ON notification_channels(enabled);

-- Alert Rule Channels: Many-to-many relationship between rules and channels
CREATE TABLE IF NOT EXISTS alert_rule_channels (
  alert_rule_id INTEGER NOT NULL,
  notification_channel_id INTEGER NOT NULL,
  PRIMARY KEY (alert_rule_id, notification_channel_id),
  FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

-- Alert History: Track all alert events
CREATE TABLE IF NOT EXISTS alert_history (
  id SERIAL PRIMARY KEY,
  alert_rule_id INTEGER NOT NULL,
  system_id INTEGER NOT NULL,
  state VARCHAR(20) NOT NULL,
  triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  metric_value NUMERIC(10,2),
  threshold_value NUMERIC(10,2),
  message TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_error TEXT,
  FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
  CONSTRAINT valid_state CHECK (state IN ('firing', 'resolved'))
);

CREATE INDEX idx_alert_history_system_id ON alert_history(system_id);
CREATE INDEX idx_alert_history_alert_rule_id ON alert_history(alert_rule_id);
CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggered_at DESC);
CREATE INDEX idx_alert_history_state ON alert_history(state);
CREATE INDEX idx_alert_history_firing ON alert_history(alert_rule_id, state) WHERE state = 'firing';

-- SMTP Configuration: Global SMTP settings (singleton table)
CREATE TABLE IF NOT EXISTS smtp_config (
  id SERIAL PRIMARY KEY,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN DEFAULT FALSE,
  auth_user VARCHAR(255),
  auth_password VARCHAR(255),
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) DEFAULT 'LogRadar Alerts',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_port CHECK (port > 0 AND port <= 65535)
);

-- Only allow one SMTP config row
CREATE UNIQUE INDEX idx_smtp_config_singleton ON smtp_config((id IS NOT NULL));
