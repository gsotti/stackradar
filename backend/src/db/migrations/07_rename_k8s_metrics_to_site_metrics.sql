-- Migration 07: Rename k8s_metrics tables to generic site_metrics
-- Makes table names platform-agnostic while preserving all data

-- Rename k8s_metrics to site_metrics
ALTER TABLE k8s_metrics RENAME TO site_metrics;

-- Rename k8s_metrics_history to site_metrics_history
ALTER TABLE k8s_metrics_history RENAME TO site_metrics_history;

-- Update indexes to match new table names (PostgreSQL renames them automatically, but we'll verify)
-- The following are informational - PostgreSQL handles this automatically
-- k8s_metrics indexes become site_metrics indexes
-- k8s_metrics_history indexes become site_metrics_history indexes
