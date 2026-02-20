-- Add has_metrics flag to sites table
-- When false, the site is used purely for uptime monitoring (no infrastructure metrics)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS has_metrics BOOLEAN NOT NULL DEFAULT TRUE;
