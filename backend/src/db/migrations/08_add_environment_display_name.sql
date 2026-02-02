-- Migration 08: Add display_name to environments
-- Allows custom display names while preserving original names for ingest matching

ALTER TABLE environments ADD COLUMN display_name VARCHAR(255);

-- Set initial display_name to be the same as name for existing records
UPDATE environments SET display_name = name WHERE display_name IS NULL;
