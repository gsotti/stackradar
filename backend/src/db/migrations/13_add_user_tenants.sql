-- Migration: Add user_tenants mapping table (many-to-many users ↔ tenants)
-- Description: Each user can be mapped to one or more tenants. New users will
-- get their own tenant on registration and will only see data for mapped tenants.

CREATE TABLE IF NOT EXISTS user_tenants (
  user_id INTEGER NOT NULL,
  tenant_id INTEGER NOT NULL,
  role VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, tenant_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);
