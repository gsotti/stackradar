-- Migration: Add user approval system
-- Description: Adds is_approved and is_admin columns to users table

-- Add is_approved column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Add is_admin column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Update existing users to be approved (backward compatibility)
UPDATE users
SET is_approved = TRUE
WHERE is_approved IS NULL OR is_approved = FALSE;

-- Set the first user as admin if no admin exists
UPDATE users
SET is_admin = TRUE
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = TRUE);
