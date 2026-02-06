-- Migration 21: User Management Roles and Invitation System
-- Implements Phase 1 of the user management system
--
-- Changes:
-- 1. Add global_role column to users (superadmin, org_admin)
-- 2. Add created_by columns to users and tenants for audit trail
-- 3. Update user_tenants.role constraint (tenant_admin, editor, viewer)
-- 4. Add email_verified column to users
-- 5. Create invitations table for user invitation flow
-- 6. Migrate existing is_admin users to org_admin
-- 7. Create indexes for performance

-- ============================================================================
-- 1. ADD GLOBAL_ROLE TO USERS TABLE
-- ============================================================================
-- global_role defines system-wide permissions:
-- - 'superadmin': Full system access, can create org_admins (DB/CLI only)
-- - 'org_admin': Can create tenants and manage users across tenants
-- - NULL: Regular user with tenant-specific roles only

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'global_role'
  ) THEN
    ALTER TABLE users ADD COLUMN global_role VARCHAR(20) DEFAULT NULL;
  END IF;
END $$;

-- Add constraint for valid global roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'users_global_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_global_role_check
      CHECK (global_role IS NULL OR global_role IN ('superadmin', 'org_admin'));
  END IF;
END $$;

-- ============================================================================
-- 2. ADD CREATED_BY TO USERS TABLE
-- ============================================================================
-- Tracks which admin created this user (for audit trail)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE users ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. ADD CREATED_BY TO TENANTS TABLE
-- ============================================================================
-- Tracks which org_admin created this tenant

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE tenants ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. UPDATE USER_TENANTS.ROLE CONSTRAINT
-- ============================================================================
-- Valid roles within a tenant:
-- - 'tenant_admin': Full control within the tenant
-- - 'editor': Can create/edit sites, alerts, monitors
-- - 'viewer': Read-only access

-- First, update any existing NULL roles to 'viewer'
UPDATE user_tenants SET role = 'viewer' WHERE role IS NULL;

-- Drop existing constraint if it exists
ALTER TABLE user_tenants DROP CONSTRAINT IF EXISTS user_tenants_role_check;

-- Add new constraint with updated values
ALTER TABLE user_tenants ADD CONSTRAINT user_tenants_role_check
  CHECK (role IN ('tenant_admin', 'editor', 'viewer'));

-- ============================================================================
-- 5. ADD EMAIL_VERIFIED TO USERS TABLE
-- ============================================================================
-- Required for invitation-only registration flow

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Set email_verified = TRUE for existing users (assume they're already verified)
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;

-- ============================================================================
-- 6. CREATE INVITATIONS TABLE
-- ============================================================================
-- Stores pending user invitations (invitation-only registration)

CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('tenant_admin', 'editor', 'viewer')),
  invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for invitations table
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_accepted_at ON invitations(accepted_at);

-- ============================================================================
-- 7. MIGRATE EXISTING is_admin USERS TO org_admin
-- ============================================================================
-- Convert existing admin users to org_admin global role
-- Keep is_admin column for backwards compatibility during transition

UPDATE users
SET global_role = 'org_admin'
WHERE is_admin = TRUE AND (global_role IS NULL OR global_role != 'superadmin');

-- ============================================================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for global_role lookups
CREATE INDEX IF NOT EXISTS idx_users_global_role ON users(global_role) WHERE global_role IS NOT NULL;

-- Index for user_tenants role lookups
CREATE INDEX IF NOT EXISTS idx_user_tenants_role ON user_tenants(role);

-- Index for created_by lookups
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON tenants(created_by) WHERE created_by IS NOT NULL;

-- Index for email_verified lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified) WHERE email_verified = FALSE;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
--
-- Backwards Compatibility:
-- - is_admin and is_viewer columns are kept (deprecated but functional)
-- - Existing code checking is_admin will continue to work
-- - Gradually migrate to checking global_role instead
--
-- Security Notes:
-- - Superadmin can ONLY be created via database insert, not API
-- - Invitation tokens should be generated securely (crypto.randomBytes)
-- - Invitation expiry default: 7 days from creation
-- - Email verification required for invitation-based registration
--
-- Next Steps:
-- - Update AuthRequest type to include global_role
-- - Create role middleware (superadmin, orgAdmin, tenantAdmin)
-- - Implement invitation flow API endpoints
-- - Update frontend to handle new role system
