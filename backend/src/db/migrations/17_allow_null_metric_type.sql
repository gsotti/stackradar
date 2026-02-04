-- Allow NULL for metric_type, threshold_operator, threshold_value
-- These are only required for metric alerts, not uptime alerts

ALTER TABLE alert_rules ALTER COLUMN metric_type DROP NOT NULL;
ALTER TABLE alert_rules ALTER COLUMN threshold_operator DROP NOT NULL;
ALTER TABLE alert_rules ALTER COLUMN threshold_value DROP NOT NULL;
