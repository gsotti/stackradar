-- Migration 10: Add pv_count to site_metrics
-- Adds support for tracking PersistentVolumes

-- Add pv_count to site_metrics
ALTER TABLE site_metrics ADD COLUMN IF NOT EXISTS pv_count INTEGER DEFAULT 0;

-- Add pv_count to site_metrics_history
ALTER TABLE site_metrics_history ADD COLUMN IF NOT EXISTS pv_count INTEGER DEFAULT 0;
