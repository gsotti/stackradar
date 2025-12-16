-- Migration: Add tenant → system → environment → application hierarchy
-- Description: Restructures grouping from cluster→pod to tenant→system_type→environment→application

-- Add new columns to log_entries
ALTER TABLE log_entries
  ADD COLUMN IF NOT EXISTS tenant VARCHAR(255),
  ADD COLUMN IF NOT EXISTS system_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS environment VARCHAR(100),
  ADD COLUMN IF NOT EXISTS application VARCHAR(255);

-- Add new columns to k8s_metrics
ALTER TABLE k8s_metrics
  ADD COLUMN IF NOT EXISTS tenant VARCHAR(255),
  ADD COLUMN IF NOT EXISTS system_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS environment VARCHAR(100),
  ADD COLUMN IF NOT EXISTS application VARCHAR(255);

-- Create indexes for new hierarchy columns on log_entries
CREATE INDEX IF NOT EXISTS idx_logs_tenant ON log_entries(tenant);
CREATE INDEX IF NOT EXISTS idx_logs_system_type ON log_entries(system_type);
CREATE INDEX IF NOT EXISTS idx_logs_environment ON log_entries(environment);
CREATE INDEX IF NOT EXISTS idx_logs_application ON log_entries(application);
CREATE INDEX IF NOT EXISTS idx_logs_hierarchy ON log_entries(tenant, system_type, environment, application);

-- Create indexes for new hierarchy columns on k8s_metrics
CREATE INDEX IF NOT EXISTS idx_k8s_tenant ON k8s_metrics(tenant);
CREATE INDEX IF NOT EXISTS idx_k8s_system_type ON k8s_metrics(system_type);
CREATE INDEX IF NOT EXISTS idx_k8s_environment ON k8s_metrics(environment);
CREATE INDEX IF NOT EXISTS idx_k8s_application ON k8s_metrics(application);

-- Migrate existing data: extract hierarchy from metadata/source
-- For log_entries: parse source field like "namespace/pod" → application
UPDATE log_entries
SET
  application = CASE
    WHEN source IS NOT NULL AND source LIKE '%/%' THEN
      SPLIT_PART(SPLIT_PART(source, '/', 2), '-', 1) || '-' || SPLIT_PART(SPLIT_PART(source, '/', 2), '-', 2)
    ELSE source
  END,
  environment = CASE
    WHEN metadata->>'namespace' IS NOT NULL THEN metadata->>'namespace'
    WHEN source IS NOT NULL AND source LIKE '%/%' THEN SPLIT_PART(source, '/', 1)
    ELSE 'unknown'
  END,
  system_type = CASE
    WHEN metadata->>'namespace' IN ('prod', 'production') THEN 'prod'
    ELSE 'nonprod'
  END,
  tenant = COALESCE(metadata->>'cluster', 'default')
WHERE application IS NULL;

-- For k8s_metrics: use cluster_name as tenant
UPDATE k8s_metrics
SET
  tenant = COALESCE(cluster_name, 'default'),
  system_type = 'nonprod',  -- Default, should be set by collector
  environment = 'unknown',   -- Should be set by collector
  application = 'cluster'    -- Metrics are at cluster level
WHERE tenant IS NULL;

-- Add comment documentation
COMMENT ON COLUMN log_entries.tenant IS 'Client/customer name (top level)';
COMMENT ON COLUMN log_entries.system_type IS 'System type: prod or nonprod';
COMMENT ON COLUMN log_entries.environment IS 'Environment: dev, staging, prod, etc.';
COMMENT ON COLUMN log_entries.application IS 'Application/deployment name: api-chart, app-chart, etc.';

COMMENT ON COLUMN k8s_metrics.tenant IS 'Client/customer name (top level)';
COMMENT ON COLUMN k8s_metrics.system_type IS 'System type: prod or nonprod';
COMMENT ON COLUMN k8s_metrics.environment IS 'Environment: dev, staging, prod, etc.';
COMMENT ON COLUMN k8s_metrics.application IS 'Application/deployment name or cluster';
