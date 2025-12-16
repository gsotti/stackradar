-- Migration: Make applications.environment_id a unique key (1 application per environment)
-- Description:
-- 1) Guard: detect duplicate non-NULL environment_id values and abort with helpful message
-- 2) Drop prior uniqueness on (environment_id, name)
-- 3) Enforce uniqueness on environment_id
-- 4) Cleanup redundant non-unique index and add comments
-- Notes:
-- - Idempotent where possible using IF EXISTS / dynamic catalog checks
-- - Postgres UNIQUE allows multiple NULLs; this keeps backwards compatibility for rows without environment assignment

-- 1) Guard for duplicates to ensure safe promotion to unique key
DO $$
DECLARE
  dup_count INTEGER;
  dup_list TEXT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT environment_id
    FROM applications
    WHERE environment_id IS NOT NULL
    GROUP BY environment_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    SELECT string_agg(environment_id::text, ', ' ORDER BY environment_id) INTO dup_list
    FROM (
      SELECT DISTINCT environment_id
      FROM applications
      WHERE environment_id IS NOT NULL
      GROUP BY environment_id
      HAVING COUNT(*) > 1
    ) x;
    RAISE EXCEPTION 'Cannot enforce unique(environment_id) on applications: found % duplicate environment_id(s): %.
Please consolidate applications so each environment_id maps to a single application before rerunning this migration.', dup_count, dup_list;
  END IF;
END $$;

-- 2) Drop existing UNIQUE (environment_id, name) if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'applications'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.constraint_name = 'applications_environment_id_name_key'
  ) THEN
    ALTER TABLE applications DROP CONSTRAINT applications_environment_id_name_key;
  END IF;
END $$;

-- 3) Add UNIQUE on environment_id if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'applications'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.constraint_name = 'applications_environment_id_key'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_environment_id_key UNIQUE (environment_id);
  END IF;
END $$;

-- 4) Cleanup: drop redundant non-unique index if it exists
-- (The UNIQUE constraint creates its own unique index on environment_id)
DROP INDEX IF EXISTS idx_applications_environment_id;

-- Comments
COMMENT ON COLUMN applications.environment_id IS 'FK to environments (1:1) — Unique per application, multiple NULLs allowed.';
