-- Migration 06: Add site_type to sites table
-- Allows specifying if a site is a Docker host, K8s cluster, or generic host

ALTER TABLE sites
ADD COLUMN site_type VARCHAR(50) DEFAULT 'kubernetes' CHECK (site_type IN ('docker', 'kubernetes', 'generic'));

-- Set existing sites to kubernetes
UPDATE sites SET site_type = 'kubernetes' WHERE site_type IS NULL;
