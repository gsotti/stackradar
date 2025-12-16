-- Migration: Remove denormalized system_type and environment columns from log_entries
-- Description:
-- These columns are redundant since we now have proper relationships through environment_id
-- System type and environment can be retrieved via JOIN with environments table
--
-- Notes:
-- - Idempotent (uses IF EXISTS)
-- - Drops indexes first, then columns

-- Drop indexes on system_type and environment
DROP INDEX IF EXISTS idx_logs_system_type;
DROP INDEX IF EXISTS idx_logs_environment;
DROP INDEX IF EXISTS idx_logs_hierarchy;

-- Drop the denormalized columns
ALTER TABLE log_entries
  DROP COLUMN IF EXISTS system_type;

ALTER TABLE log_entries
  DROP COLUMN IF EXISTS environment;

-- Add comment
COMMENT ON TABLE log_entries IS 'Log entries with relationships to environments. System type and environment name are accessed via environments table.';
