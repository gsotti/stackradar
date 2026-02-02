-- Migration 02: Create Data Tables
-- Tables for logs, K8s metrics, and history

-- ============================================================================
-- 1. LOG ENTRIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS log_entries (
  id SERIAL PRIMARY KEY,
  system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  level VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  source VARCHAR(255),
  metadata JSONB,

  -- Legacy fields for backward compatibility with collector
  tenant VARCHAR(255),
  site VARCHAR(255),
  environment VARCHAR(255),
  system VARCHAR(255),
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_log_entries_system_id ON log_entries(system_id);
CREATE INDEX idx_log_entries_timestamp ON log_entries(timestamp DESC);
CREATE INDEX idx_log_entries_level ON log_entries(level);
CREATE INDEX idx_logs_system_timestamp ON log_entries(system_id, timestamp DESC);
CREATE INDEX idx_log_entries_tenant_id ON log_entries(tenant_id);

-- ============================================================================
-- 2. K8S METRICS TABLE (Current/Latest Metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS k8s_metrics (
  id SERIAL PRIMARY KEY,
  site_id INTEGER UNIQUE NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  -- Node metrics
  node_count INTEGER DEFAULT 0,
  node_ready INTEGER DEFAULT 0,

  -- Pod metrics
  pod_count INTEGER DEFAULT 0,
  pod_running INTEGER DEFAULT 0,
  pod_pending INTEGER DEFAULT 0,
  pod_failed INTEGER DEFAULT 0,

  -- Deployment metrics
  deployment_count INTEGER DEFAULT 0,
  deployment_ready INTEGER DEFAULT 0,

  -- Resource usage
  cpu_usage_percent DECIMAL(5,2) DEFAULT 0,
  memory_usage_percent DECIMAL(5,2) DEFAULT 0,

  -- Storage metrics
  pvc_count INTEGER DEFAULT 0,
  pvc_bound INTEGER DEFAULT 0,

  -- Legacy field for backward compatibility
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,

  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_k8s_metrics_site_id ON k8s_metrics(site_id);
CREATE INDEX idx_k8s_metrics_tenant_id ON k8s_metrics(tenant_id);

-- ============================================================================
-- 3. K8S METRICS HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS k8s_metrics_history (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,

  -- Node metrics
  node_count INTEGER DEFAULT 0,
  node_ready INTEGER DEFAULT 0,

  -- Pod metrics
  pod_count INTEGER DEFAULT 0,
  pod_running INTEGER DEFAULT 0,
  pod_pending INTEGER DEFAULT 0,
  pod_failed INTEGER DEFAULT 0,

  -- Deployment metrics
  deployment_count INTEGER DEFAULT 0,
  deployment_ready INTEGER DEFAULT 0,

  -- Resource usage
  cpu_usage_percent DECIMAL(5,2) DEFAULT 0,
  memory_usage_percent DECIMAL(5,2) DEFAULT 0,

  -- Storage metrics
  pvc_count INTEGER DEFAULT 0,
  pvc_bound INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_k8s_metrics_history_site_id ON k8s_metrics_history(site_id);
CREATE INDEX idx_k8s_metrics_history_timestamp ON k8s_metrics_history(timestamp DESC);
CREATE INDEX idx_k8s_metrics_history_site_time ON k8s_metrics_history(site_id, timestamp DESC);
