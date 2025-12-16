-- Migration: Remove unique constraint on tenant names
-- Description: Allow multiple tenants with the same name (each user gets their own "Default" tenant)

-- Drop the unique constraint on tenants.name
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_name_key;
