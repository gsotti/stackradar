-- Migration: Replace log_entries.system_id with environment_id
-- Description:
-- 1) Add log_entries.environment_id (FK to environments)
-- 2) Backfill environment_id from existing data
--    - Prefer applications.environment_id via application_id if available
--    - Fallback: match environments by (system_id from logs.system_id, name from logs.environment)
--    - As last resort: create environment with name from logs.environment (or 'unknown') under the system
-- 3) Create indexes for environment_id
-- 4) Drop log_entries.system_id and its indexes/constraints
-- Notes:
-- - Idempotent where possible (IF EXISTS / IF NOT EXISTS)

-- 1) Add environment_id column
ALTER TABLE log_entries
  ADD COLUMN IF NOT EXISTS environment_id INTEGER;

-- 2) Backfill from applications.environment_id if the relationship exists
DO $$
DECLARE
  has_applications BOOLEAN := FALSE;
  has_app_env_col BOOLEAN := FALSE;
  has_log_app_col BOOLEAN := FALSE;
  has_logs_env_text BOOLEAN := FALSE;
  r RECORD;
BEGIN
  -- Detect availability of required tables/columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'applications'
  ) INTO has_applications;

  IF has_applications THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'applications' AND column_name = 'environment_id'
    ) INTO has_app_env_col;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'log_entries' AND column_name = 'application_id'
  ) INTO has_log_app_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'log_entries' AND column_name = 'environment'
  ) INTO has_logs_env_text;

  -- 2a) If we can, backfill directly from applications.environment_id using application_id
  IF has_applications AND has_app_env_col AND has_log_app_col THEN
    UPDATE log_entries le
    SET environment_id = a.environment_id
    FROM applications a
    WHERE le.application_id IS NOT NULL
      AND a.id = le.application_id
      AND le.environment_id IS NULL
      AND a.environment_id IS NOT NULL;
  END IF;

  -- 2b) Fallback: match environments by (system_id, environment name)
  IF has_logs_env_text THEN
    UPDATE log_entries le
    SET environment_id = e.id
    FROM environments e
    WHERE le.environment_id IS NULL
      AND e.system_id = le.system_id
      AND COALESCE(le.environment, 'unknown') = e.name;
  END IF;

  -- 2c) As last resort: create missing environments per (system_id, environment name)
  IF has_logs_env_text THEN
    FOR r IN
      SELECT DISTINCT le.system_id AS sys_id, COALESCE(NULLIF(TRIM(le.environment), ''), 'unknown') AS env_name
      FROM log_entries le
      WHERE le.environment_id IS NULL AND le.system_id IS NOT NULL
    LOOP
      -- Insert environment if it doesn't exist yet
      INSERT INTO environments (system_id, name)
      VALUES (r.sys_id, r.env_name)
      ON CONFLICT (system_id, name) DO NOTHING;

      -- Update any rows for this pair
      UPDATE log_entries le
      SET environment_id = e.id
      FROM environments e
      WHERE le.environment_id IS NULL
        AND le.system_id = r.sys_id
        AND COALESCE(NULLIF(TRIM(le.environment), ''), 'unknown') = r.env_name
        AND e.system_id = r.sys_id
        AND e.name = r.env_name;
    END LOOP;
  END IF;
END $$;

-- 3) Add FK constraint if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'log_entries'
      AND tc.constraint_name = 'fk_log_entries_environment'
  ) THEN
    ALTER TABLE log_entries
      ADD CONSTRAINT fk_log_entries_environment
      FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3a) Indexes for environment_id
CREATE INDEX IF NOT EXISTS idx_log_entries_environment_id ON log_entries(environment_id);
CREATE INDEX IF NOT EXISTS idx_logs_environment_timestamp ON log_entries(environment_id, timestamp DESC);

-- 4) Drop old FK to systems if exists (on system_id) and dependent indexes
-- Try commonly named constraints and indexes first
ALTER TABLE log_entries DROP CONSTRAINT IF EXISTS log_entries_system_id_fkey;
ALTER TABLE log_entries DROP CONSTRAINT IF EXISTS log_entries_systems_fkey;

DROP INDEX IF EXISTS idx_logs_system_id;
DROP INDEX IF EXISTS idx_logs_system_timestamp;

-- Finally drop the system_id column
ALTER TABLE log_entries
  DROP COLUMN IF EXISTS system_id;

-- Comments
COMMENT ON COLUMN log_entries.environment_id IS 'FK to environments table (replaces system_id)';

ALTER TABLE applications
    DROP COLUMN IF EXISTS environment;