-- Migration 16: Make alert_rule_id nullable for test alerts
-- Allows creating test alerts without an associated rule

ALTER TABLE alert_history
  ALTER COLUMN alert_rule_id DROP NOT NULL;

-- Update the foreign key to allow NULL
-- The existing foreign key already has ON DELETE CASCADE which is fine
