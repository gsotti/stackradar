-- Drop deprecated columns is_admin and is_viewer
-- These have been replaced by the global_role column and per-tenant roles in user_tenants table

ALTER TABLE users DROP COLUMN IF EXISTS is_admin;
ALTER TABLE users DROP COLUMN IF EXISTS is_viewer;
