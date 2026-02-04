-- Add alert_type and monitor_id to alert_rules for uptime alerts

ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS alert_type VARCHAR(10) DEFAULT 'metric';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS monitor_id INTEGER REFERENCES uptime_monitors(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_alert_rules_alert_type ON alert_rules(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_monitor_id ON alert_rules(monitor_id);
