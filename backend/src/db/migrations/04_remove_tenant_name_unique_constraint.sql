-- Migration 04: Remove unique constraint on tenant names
-- This allows multiple tenants to have the same name (e.g., "default" for each user)

-- Drop the unique constraint on tenant name
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_name_key;

-- The index idx_tenants_name will remain for query performance
