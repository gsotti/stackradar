-- Migration: Update systems to reference tenants instead of users
-- Description:
-- 1) Add systems.tenant_id (FK to tenants) and backfill
-- 2) Drop systems.user_id and its FK
-- Notes:
-- - Idempotent where possible (IF EXISTS / IF NOT EXISTS)
-- - Backfills existing rows to "Default" tenant

-- Ensure Default tenant exists
INSERT INTO tenants (name, description)
VALUES ('Default', 'Default tenant for uncategorized logs and metrics')
ON CONFLICT (name) DO NOTHING;

-- 1) Add tenant_id column
ALTER TABLE systems
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER;

-- 1a) Backfill existing rows with Default tenant
UPDATE systems s
SET tenant_id = (
  SELECT id FROM tenants WHERE name = 'Default'
)
WHERE tenant_id IS NULL;

-- 1b) Add FK constraint to tenants(id) if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'systems'
      AND tc.constraint_name = 'fk_systems_tenant'
  ) THEN
    ALTER TABLE systems
      ADD CONSTRAINT fk_systems_tenant
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 1c) Create index for tenant_id
CREATE INDEX IF NOT EXISTS idx_systems_tenant_id ON systems(tenant_id);

-- 1d) Make tenant_id NOT NULL (after backfill)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name = 'systems' AND c.column_name = 'tenant_id' AND c.is_nullable = 'YES'
  ) THEN
    -- Ensure no NULLs remain before setting NOT NULL
    UPDATE systems s SET tenant_id = (
      SELECT id FROM tenants WHERE name = 'Default'
    ) WHERE tenant_id IS NULL;
    ALTER TABLE systems ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- 2) Drop old FK on user_id if exists, then drop the column
-- Try the default Postgres-generated name first
ALTER TABLE systems DROP CONSTRAINT IF EXISTS systems_user_id_fkey;

-- In case a custom constraint name was used, search and drop dynamically
DO $$
DECLARE
  conname TEXT;
BEGIN
  SELECT con.constraint_name INTO conname
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.table_constraints con
    ON con.constraint_name = kcu.constraint_name
   AND con.table_name = kcu.table_name
  WHERE kcu.table_name = 'systems'
    AND kcu.column_name = 'user_id'
    AND con.constraint_type = 'FOREIGN KEY'
  LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE systems DROP CONSTRAINT %I;', conname);
  END IF;
END $$;

-- Drop potential index on user_id (none created in initial schema, but safe)
DROP INDEX IF EXISTS idx_systems_user_id;

-- Finally drop the column
ALTER TABLE systems
  DROP COLUMN IF EXISTS user_id;

-- Comments
COMMENT ON COLUMN systems.tenant_id IS 'FK to tenants table (replaces previous user ownership)';
