-- Migration: Remove denormalized system_type and environment columns from k8s_metrics
-- Description:
-- These columns are redundant since k8s_metrics is linked to systems via system_id
-- System type and environment should be determined through the system's relationships
--
-- Notes:
-- - Idempotent (uses IF EXISTS)
-- - Drops indexes first, then columns

-- Drop indexes on system_type and environment
DROP INDEX IF EXISTS idx_k8s_system_type;
DROP INDEX IF EXISTS idx_k8s_environment;

-- Drop the denormalized columns
ALTER TABLE k8s_metrics
  DROP COLUMN IF EXISTS system_type;

ALTER TABLE k8s_metrics
  DROP COLUMN IF EXISTS environment;

-- Add comment
COMMENT ON TABLE k8s_metrics IS 'Kubernetes cluster metrics linked to systems. Access system details via system_id foreign key.';
