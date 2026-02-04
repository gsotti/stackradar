-- Add cooldown_minutes and created_by to alert_rules

ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER DEFAULT 30;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_alert_rules_created_by ON alert_rules(created_by);
