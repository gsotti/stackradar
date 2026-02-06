-- Migration: Add index for uptime monitors interval-based queries
-- This index speeds up the new interval-specific cron jobs

CREATE INDEX IF NOT EXISTS idx_uptime_monitors_interval_enabled
ON uptime_monitors(interval_seconds)
WHERE enabled = true;
