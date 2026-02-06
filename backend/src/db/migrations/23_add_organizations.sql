-- Migration 23: Add Organizations Table
-- Creates explicit organizational boundaries for users and tenants

-- ============================================================================
-- 1. CREATE ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. ADD ORGANIZATION_ID TO USERS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. ADD ORGANIZATION_ID TO TENANTS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenants_organization_id ON tenants(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

-- ============================================================================
-- 5. DATA MIGRATION - Create organizations for existing org_admins
-- ============================================================================

-- Each existing org_admin gets their own organization
INSERT INTO organizations (name, description, created_by, created_at)
SELECT
  COALESCE(u.name, SPLIT_PART(u.email, '@', 1)) || '''s Organization',
  'Auto-created during migration',
  u.id,
  u.created_at
FROM users u
WHERE u.global_role = 'org_admin'
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE created_by = u.id);

-- ============================================================================
-- 6. ASSIGN ORG_ADMINS TO THEIR ORGANIZATIONS
-- ============================================================================

UPDATE users u
SET organization_id = o.id
FROM organizations o
WHERE o.created_by = u.id
  AND u.global_role = 'org_admin'
  AND u.organization_id IS NULL;

-- ============================================================================
-- 7. ASSIGN TENANTS TO ORGANIZATIONS
-- ============================================================================
-- Based on who created them

UPDATE tenants t
SET organization_id = u.organization_id
FROM users u
WHERE t.created_by = u.id
  AND u.organization_id IS NOT NULL
  AND t.organization_id IS NULL;

-- ============================================================================
-- 8. ASSIGN REMAINING USERS TO ORGANIZATIONS
-- ============================================================================
-- Based on their tenant memberships (first tenant's org)

UPDATE users u
SET organization_id = (
  SELECT t.organization_id
  FROM user_tenants ut
  JOIN tenants t ON ut.tenant_id = t.id
  WHERE ut.user_id = u.id AND t.organization_id IS NOT NULL
  LIMIT 1
)
WHERE u.organization_id IS NULL
  AND u.global_role IS NULL
  AND EXISTS (
    SELECT 1 FROM user_tenants ut
    JOIN tenants t ON ut.tenant_id = t.id
    WHERE ut.user_id = u.id AND t.organization_id IS NOT NULL
  );
