-- Migration 11: Add service_count to site_metrics
-- Adds support for tracking Service counts

-- Add service_count to site_metrics
ALTER TABLE site_metrics ADD COLUMN IF NOT EXISTS service_count INTEGER DEFAULT 0;

-- Add service_count to site_metrics_history
ALTER TABLE site_metrics_history ADD COLUMN IF NOT EXISTS service_count INTEGER DEFAULT 0;
