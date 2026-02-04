-- Add failure_threshold to alert_rules for uptime alerts
-- This controls how many consecutive failures before alerting

ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS failure_threshold INTEGER DEFAULT 3;
