-- Migration 31: Add absolute CPU and memory values to site_metrics tables
ALTER TABLE site_metrics
  ADD COLUMN IF NOT EXISTS cpu_used_cores FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpu_total_cores FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_used_gb FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_total_gb FLOAT DEFAULT 0;

ALTER TABLE site_metrics_history
  ADD COLUMN IF NOT EXISTS cpu_used_cores FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpu_total_cores FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_used_gb FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_total_gb FLOAT DEFAULT 0;
