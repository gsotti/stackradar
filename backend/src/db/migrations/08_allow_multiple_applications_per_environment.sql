-- Migration: Allow multiple applications per environment
-- Description:
-- 1) Drop UNIQUE constraint on applications.environment_id (if present)
-- 2) Recreate helpful non-unique index on applications(environment_id)
-- 3) Update column comment to reflect non-unique nature
-- Notes:
-- - Idempotent where possible using IF EXISTS checks

-- 1) Drop UNIQUE on environment_id if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'applications'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.constraint_name = 'applications_environment_id_key'
  ) THEN
    -- Use dynamic SQL to avoid errors in tools that pre-validate constraint names
    EXECUTE format('ALTER TABLE applications DROP CONSTRAINT %I;', 'applications_environment_id_key');
  END IF;
END $$;


-- 2) Helpful index for joins/filters on environment_id
-- (Composite unique creates an index on (environment_id, name), but a single-column
--  index can still help some queries that filter only on environment_id.)
CREATE INDEX IF NOT EXISTS idx_applications_environment_id ON applications(environment_id);

-- 3) Update column comment
COMMENT ON COLUMN applications.environment_id IS 'FK to environments (many-to-one). Multiple applications can share an environment names must be unique per environment.';

