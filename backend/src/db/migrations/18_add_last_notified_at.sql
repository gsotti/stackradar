-- Migration 18: Add last_notified_at to alert_history
-- This allows for recurring notifications for alerts that are still firing.

ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP;

-- Set initial value for existing firing alerts to triggered_at
UPDATE alert_history SET last_notified_at = triggered_at WHERE last_notified_at IS NULL;
