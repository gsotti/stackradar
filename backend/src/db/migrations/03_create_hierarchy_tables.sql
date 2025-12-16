-- Migration: Create hierarchy tables (tenants and applications)
-- Description: Creates proper hierarchical structure with tenant → system_type → environment → application

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Applications table (includes system_type and environment)
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  system_type VARCHAR(100) NOT NULL CHECK (system_type IN ('prod', 'nonprod')),
  environment VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, name, system_type, environment)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_applications_tenant_id ON applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_applications_system_type ON applications(system_type);
CREATE INDEX IF NOT EXISTS idx_applications_environment ON applications(environment);
CREATE INDEX IF NOT EXISTS idx_applications_hierarchy ON applications(tenant_id, system_type, environment);

-- Insert default tenant
INSERT INTO tenants (name, description)
VALUES ('Default', 'Default tenant for uncategorized logs and metrics')
ON CONFLICT (name) DO NOTHING;

-- Migrate existing log_entries: link to tenant_id and application_id
-- First, add foreign key columns
ALTER TABLE log_entries
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER,
  ADD COLUMN IF NOT EXISTS application_id INTEGER;

-- Set default tenant for existing logs without tenant
UPDATE log_entries
SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default')
WHERE tenant_id IS NULL;

-- Create or find applications for existing log entries
DO $$
DECLARE
  default_tenant_id INTEGER;
  log_rec RECORD;
  app_id INTEGER;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants WHERE name = 'Default';

  -- Loop through distinct combinations in log_entries
  FOR log_rec IN
    SELECT DISTINCT
      COALESCE(tenant, 'Default') as tenant_name,
      COALESCE(application, 'unknown') as app_name,
      COALESCE(system_type, 'nonprod') as sys_type,
      COALESCE(environment, 'unknown') as env
    FROM log_entries
    WHERE application IS NOT NULL
  LOOP
    -- Get or create tenant
    INSERT INTO tenants (name, description)
    VALUES (log_rec.tenant_name, 'Auto-created from existing logs')
    ON CONFLICT (name) DO NOTHING;

    -- Get or create application
    INSERT INTO applications (tenant_id, name, system_type, environment, description)
    SELECT t.id, log_rec.app_name, log_rec.sys_type, log_rec.env, 'Auto-created from existing logs'
    FROM tenants t
    WHERE t.name = log_rec.tenant_name
    ON CONFLICT (tenant_id, name, system_type, environment) DO NOTHING;

    -- Update log entries with application_id and tenant_id
    UPDATE log_entries le
    SET
      application_id = a.id,
      tenant_id = a.tenant_id
    FROM applications a
    JOIN tenants t ON a.tenant_id = t.id
    WHERE t.name = log_rec.tenant_name
      AND a.name = log_rec.app_name
      AND a.system_type = log_rec.sys_type
      AND a.environment = log_rec.env
      AND le.tenant = log_rec.tenant_name
      AND le.application = log_rec.app_name
      AND le.system_type = log_rec.sys_type
      AND le.environment = log_rec.env;
  END LOOP;
END $$;

-- Do the same for k8s_metrics
ALTER TABLE k8s_metrics
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER,
  ADD COLUMN IF NOT EXISTS application_id INTEGER;

-- Set default tenant for existing metrics without tenant
UPDATE k8s_metrics
SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default')
WHERE tenant_id IS NULL;

-- Create applications for k8s_metrics
DO $$
DECLARE
  default_tenant_id INTEGER;
  metric_rec RECORD;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants WHERE name = 'Default';

  FOR metric_rec IN
    SELECT DISTINCT
      COALESCE(tenant, 'Default') as tenant_name,
      COALESCE(application, 'cluster') as app_name,
      COALESCE(system_type, 'nonprod') as sys_type,
      COALESCE(environment, 'unknown') as env
    FROM k8s_metrics
    WHERE application IS NOT NULL
  LOOP
    -- Get or create tenant
    INSERT INTO tenants (name, description)
    VALUES (metric_rec.tenant_name, 'Auto-created from existing metrics')
    ON CONFLICT (name) DO NOTHING;

    -- Get or create application
    INSERT INTO applications (tenant_id, name, system_type, environment, description)
    SELECT t.id, metric_rec.app_name, metric_rec.sys_type, metric_rec.env, 'Auto-created from existing metrics'
    FROM tenants t
    WHERE t.name = metric_rec.tenant_name
    ON CONFLICT (tenant_id, name, system_type, environment) DO NOTHING;

    -- Update metrics with application_id and tenant_id
    UPDATE k8s_metrics km
    SET
      application_id = a.id,
      tenant_id = a.tenant_id
    FROM applications a
    JOIN tenants t ON a.tenant_id = t.id
    WHERE t.name = metric_rec.tenant_name
      AND a.name = metric_rec.app_name
      AND a.system_type = metric_rec.sys_type
      AND a.environment = metric_rec.env
      AND km.tenant = metric_rec.tenant_name
      AND km.application = metric_rec.app_name
      AND km.system_type = metric_rec.sys_type
      AND km.environment = metric_rec.env;
  END LOOP;
END $$;

-- Add foreign key constraints
ALTER TABLE log_entries
  ADD CONSTRAINT fk_log_entries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_log_entries_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL;

ALTER TABLE k8s_metrics
  ADD CONSTRAINT fk_k8s_metrics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_k8s_metrics_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL;

-- Create indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_log_entries_tenant_id ON log_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_application_id ON log_entries(application_id);
CREATE INDEX IF NOT EXISTS idx_k8s_metrics_tenant_id ON k8s_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_k8s_metrics_application_id ON k8s_metrics(application_id);

-- Add comments
COMMENT ON TABLE tenants IS 'Top-level hierarchy: clients/customers';
COMMENT ON TABLE applications IS 'Applications within tenant → system_type → environment hierarchy';
COMMENT ON COLUMN log_entries.tenant_id IS 'Foreign key to tenants table';
COMMENT ON COLUMN log_entries.application_id IS 'Foreign key to applications table';
COMMENT ON COLUMN k8s_metrics.tenant_id IS 'Foreign key to tenants table';
COMMENT ON COLUMN k8s_metrics.application_id IS 'Foreign key to applications table';
