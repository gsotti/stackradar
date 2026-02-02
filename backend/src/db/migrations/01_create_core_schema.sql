-- Migration 01: Create Core Hierarchy Schema
-- New hierarchy: Tenant → Site → Environment → System

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_approved BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_approved ON users(is_approved);

-- ============================================================================
-- 2. TENANTS TABLE (Level 1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenants_name ON tenants(name);

-- ============================================================================
-- 3. SITES TABLE (Level 2 - was "systems")
-- ============================================================================
CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  api_token VARCHAR(255) UNIQUE NOT NULL,
  retention_days INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_sites_tenant_id ON sites(tenant_id);
CREATE INDEX idx_sites_api_token ON sites(api_token);
CREATE INDEX idx_sites_name ON sites(name);

-- ============================================================================
-- 4. ENVIRONMENTS TABLE (Level 3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS environments (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL CHECK (name IN ('dev', 'staging', 'prod')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, name)
);

CREATE INDEX idx_environments_site_id ON environments(site_id);
CREATE INDEX idx_environments_name ON environments(name);

-- ============================================================================
-- 5. SYSTEMS TABLE (Level 4 - was "applications")
-- ============================================================================
CREATE TABLE IF NOT EXISTS systems (
  id SERIAL PRIMARY KEY,
  environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(environment_id, name)
);

CREATE INDEX idx_systems_environment_id ON systems(environment_id);
CREATE INDEX idx_systems_name ON systems(name);

-- ============================================================================
-- 6. USER-TENANT MAPPING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_tenants (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON user_tenants(tenant_id);
