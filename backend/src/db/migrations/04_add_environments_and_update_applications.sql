-- Migration: Add environments table and update applications to reference it
-- Description:
-- 1) Create table environments(id, system_id, name, created_at, deleted_at)
-- 2) Update applications: remove tenant_id and system_type; add environment_id FK to environments
-- Notes:
-- - Idempotent: uses IF EXISTS / IF NOT EXISTS where possible
-- - Does NOT attempt data backfill for environment_id because applications currently
--   have no relation to systems; mapping must be handled at the application level

-- 1) Environments table
CREATE TABLE IF NOT EXISTS environments (
  id SERIAL PRIMARY KEY,
  system_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE,
  UNIQUE (system_id, name)
);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_environments_system_id ON environments(system_id);

COMMENT ON TABLE environments IS 'Environment per system (e.g., dev, staging, prod)';
COMMENT ON COLUMN environments.system_id IS 'FK to systems table';
COMMENT ON COLUMN environments.name IS 'Environment name within a system (unique per system)';
COMMENT ON COLUMN environments.deleted_at IS 'Soft delete timestamp';

-- 2) Update applications table
-- Add environment_id column and FK
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS environment_id INTEGER;

-- Add FK (will be created only once)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'applications'
      AND tc.constraint_name = 'fk_applications_environment'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT fk_applications_environment
      FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for environment_id
CREATE INDEX IF NOT EXISTS idx_applications_environment_id ON applications(environment_id);

-- Drop old columns if present
ALTER TABLE applications
  DROP COLUMN IF EXISTS tenant_id,
  DROP COLUMN IF EXISTS system_type;

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_applications_tenant_id;
DROP INDEX IF EXISTS idx_applications_system_type;
DROP INDEX IF EXISTS idx_applications_hierarchy;

-- Drop old unique constraint on (tenant_id, name, system_type, environment) if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'applications'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.constraint_name = 'applications_tenant_id_name_system_type_environment_key'
  ) THEN
    ALTER TABLE applications DROP CONSTRAINT applications_tenant_id_name_system_type_environment_key;
  END IF;
END $$;

-- Create new uniqueness on (environment_id, name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'applications'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.constraint_name = 'applications_environment_id_name_key'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_environment_id_name_key UNIQUE (environment_id, name);
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN applications.environment_id IS 'FK to environments table (replaces system_type + tenant-based hierarchy)';
