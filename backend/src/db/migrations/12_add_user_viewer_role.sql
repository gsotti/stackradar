-- Add is_viewer column to users table
-- Viewers can only read data, not create/update/delete

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_viewer BOOLEAN NOT NULL DEFAULT false;
