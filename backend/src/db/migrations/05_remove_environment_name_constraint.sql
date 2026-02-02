-- Migration 05: Remove environment name check constraint
-- Allow any environment name instead of restricting to dev/staging/prod

ALTER TABLE environments DROP CONSTRAINT IF EXISTS environments_name_check;

-- Update the column to allow any varchar without the check constraint
ALTER TABLE environments ALTER COLUMN name TYPE VARCHAR(255);
