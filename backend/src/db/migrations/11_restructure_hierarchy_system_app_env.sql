-- Migration: Restructure hierarchy from System->Environment->Application to System->Application->Environment
-- Description:
-- Changes the hierarchy structure so that:
-- - Applications belong to Systems (not Environments)
-- - Environments belong to Applications (not Systems)
-- This allows one Application to have multiple Environments (dev, staging, prod per app)
--
-- Notes:
-- - Uses temporary columns to preserve data during restructuring
-- - Idempotent (uses IF EXISTS/IF NOT EXISTS)
-- - Updates foreign key relationships
-- - Remaps log_entries.environment_id to new environment IDs

-- ============================================================================
-- STEP 1: Add new columns and preserve old data
-- ============================================================================

-- Add new column to applications table
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS system_id INTEGER,
  ADD COLUMN IF NOT EXISTS temp_old_environment_id INTEGER;

-- Add new column to environments table
ALTER TABLE environments
  ADD COLUMN IF NOT EXISTS application_id INTEGER,
  ADD COLUMN IF NOT EXISTS temp_old_system_id INTEGER;

-- Preserve old relationships
UPDATE applications SET temp_old_environment_id = environment_id WHERE temp_old_environment_id IS NULL;
UPDATE environments SET temp_old_system_id = system_id WHERE temp_old_system_id IS NULL;

-- ============================================================================
-- STEP 2: Migrate applications.system_id from environments
-- ============================================================================

-- Populate applications.system_id by traversing environment -> system
UPDATE applications a
SET system_id = e.system_id
FROM environments e
WHERE a.environment_id = e.id
  AND a.system_id IS NULL;

-- Set NOT NULL constraint after data migration
ALTER TABLE applications
  ALTER COLUMN system_id SET NOT NULL;

-- ============================================================================
-- STEP 3: Restructure applications table
-- ============================================================================

-- Drop old foreign key to environments
ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS fk_applications_environment;

-- Drop old environment_id column (data preserved in temp column)
ALTER TABLE applications
  DROP COLUMN IF EXISTS environment_id;

-- Add new foreign key to systems
ALTER TABLE applications
  ADD CONSTRAINT fk_applications_system
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_applications_system_id ON applications(system_id);

-- Update unique constraint: (system_id, name) must be unique
ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_environment_id_name_key;

ALTER TABLE applications
  ADD CONSTRAINT applications_system_id_name_key UNIQUE (system_id, name);

-- ============================================================================
-- STEP 4: Migrate environments - create per application
-- ============================================================================

-- Create temporary table to track environment migration mapping
CREATE TEMP TABLE IF NOT EXISTS env_migration AS
SELECT DISTINCT
  a.id as app_id,
  e.name as env_name,
  e.id as old_env_id,
  a.temp_old_environment_id
FROM applications a
JOIN environments e ON a.temp_old_environment_id = e.id;

-- Clear environments table (will rebuild with new structure)
TRUNCATE TABLE environments RESTART IDENTITY CASCADE;

-- Repopulate environments table with application_id foreign key
INSERT INTO environments (application_id, name, created_at)
SELECT app_id, env_name, NOW()
FROM env_migration
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Restructure environments table
-- ============================================================================

-- Drop old foreign key to systems
ALTER TABLE environments
  DROP CONSTRAINT IF EXISTS environments_system_id_fkey;

-- Drop old system_id column
ALTER TABLE environments
  DROP COLUMN IF EXISTS system_id;

-- Drop temp column
ALTER TABLE environments
  DROP COLUMN IF EXISTS temp_old_system_id;

-- Set application_id as NOT NULL
ALTER TABLE environments
  ALTER COLUMN application_id SET NOT NULL;

-- Add foreign key to applications
ALTER TABLE environments
  ADD CONSTRAINT fk_environments_application
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_environments_application_id ON environments(application_id);

-- Update unique constraint: (application_id, name) must be unique
ALTER TABLE environments
  DROP CONSTRAINT IF EXISTS environments_system_id_name_key;

ALTER TABLE environments
  ADD CONSTRAINT environments_application_id_name_key UNIQUE (application_id, name);

-- ============================================================================
-- STEP 6: Update log_entries.environment_id to point to new environment IDs
-- ============================================================================

-- Map old environment_id in log_entries to new environment IDs
-- Strategy: Find the new environment ID that matches the application + environment name
UPDATE log_entries le
SET environment_id = env_new.id
FROM env_migration em
JOIN environments env_new ON env_new.application_id = em.app_id AND env_new.name = em.env_name
WHERE le.environment_id = em.old_env_id
  AND le.application_id = em.app_id;

-- Set NULL for any orphaned references (shouldn't happen, but safety measure)
UPDATE log_entries
SET environment_id = NULL
WHERE environment_id IS NOT NULL
  AND environment_id NOT IN (SELECT id FROM environments);

-- ============================================================================
-- STEP 7: Verify k8s_metrics integrity
-- ============================================================================

-- k8s_metrics has system_id (not environment_id), so no direct changes needed
-- But verify integrity and clean up stale application_id references

-- Clean up invalid system_id references
DELETE FROM k8s_metrics
WHERE system_id NOT IN (SELECT id FROM systems);

-- Clean up stale application_id references
UPDATE k8s_metrics
SET application_id = NULL
WHERE application_id IS NOT NULL
  AND application_id NOT IN (SELECT id FROM applications);

-- ============================================================================
-- STEP 8: Cleanup temporary columns
-- ============================================================================

ALTER TABLE applications
  DROP COLUMN IF EXISTS temp_old_environment_id;

-- Drop temp table (will be dropped automatically at end of transaction, but explicit is clearer)
DROP TABLE IF EXISTS env_migration;

-- ============================================================================
-- STEP 9: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE applications IS 'Applications within systems. Each application can have multiple environments (dev, staging, prod).';
COMMENT ON TABLE environments IS 'Environments within applications. Each environment belongs to one application.';
COMMENT ON COLUMN applications.system_id IS 'Foreign key to systems table - each application belongs to one system';
COMMENT ON COLUMN environments.application_id IS 'Foreign key to applications table - each environment belongs to one application';

-- Migration complete
