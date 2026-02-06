-- Migration 19: Add repeat_interval_hours to alert_rules
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS repeat_interval_hours INTEGER DEFAULT 1;

-- Add check constraint for the 1-24 range
ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_repeat_interval_check CHECK (repeat_interval_hours >= 1 AND repeat_interval_hours <= 24);
