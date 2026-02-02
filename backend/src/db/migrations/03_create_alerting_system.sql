-- Migration 03: Create Alerting System
-- Alert rules, notification channels, and history

-- ============================================================================
-- 1. ALERT RULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,

  -- Metric configuration
  metric_type VARCHAR(50) NOT NULL,
  threshold_operator VARCHAR(10) NOT NULL CHECK (threshold_operator IN ('>', '>=', '<', '<=', '=')),
  threshold_value DECIMAL(10,2) NOT NULL,
  time_window_minutes INTEGER DEFAULT 5,

  -- Alert severity
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(site_id, name)
);

CREATE INDEX idx_alert_rules_site_id ON alert_rules(site_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_metric_type ON alert_rules(metric_type);

-- ============================================================================
-- 2. NOTIFICATION CHANNELS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_channels (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('email', 'webhook')),
  enabled BOOLEAN DEFAULT TRUE,

  -- Email configuration
  email_recipients TEXT[],

  -- Webhook configuration
  webhook_url TEXT,
  webhook_headers JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(site_id, name)
);

CREATE INDEX idx_notification_channels_site_id ON notification_channels(site_id);
CREATE INDEX idx_notification_channels_enabled ON notification_channels(enabled);

-- ============================================================================
-- 3. ALERT RULE CHANNELS MAPPING (M2M)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_rule_channels (
  alert_rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  notification_channel_id INTEGER NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (alert_rule_id, notification_channel_id)
);

CREATE INDEX idx_alert_rule_channels_rule ON alert_rule_channels(alert_rule_id);
CREATE INDEX idx_alert_rule_channels_channel ON alert_rule_channels(notification_channel_id);

-- ============================================================================
-- 4. ALERT HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_history (
  id SERIAL PRIMARY KEY,
  alert_rule_id INTEGER REFERENCES alert_rules(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  state VARCHAR(20) NOT NULL CHECK (state IN ('firing', 'resolved')),

  -- Alert details
  metric_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  message TEXT,

  -- Timestamps
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,

  -- Notification status
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_error TEXT
);

CREATE INDEX idx_alert_history_alert_rule_id ON alert_history(alert_rule_id);
CREATE INDEX idx_alert_history_site_id ON alert_history(site_id);
CREATE INDEX idx_alert_history_state ON alert_history(state);
CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggered_at DESC);

-- ============================================================================
-- 5. SMTP CONFIGURATION TABLE (Global)
-- ============================================================================
CREATE TABLE IF NOT EXISTS smtp_config (
  id SERIAL PRIMARY KEY,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  secure BOOLEAN DEFAULT FALSE,
  auth_user VARCHAR(255),
  auth_password VARCHAR(255),
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255) DEFAULT 'LogRadar Alerts',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
