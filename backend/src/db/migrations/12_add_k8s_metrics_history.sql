-- Migration: Add k8s_metrics_history table for time-series snapshots
-- Description: Stores historical snapshots of Kubernetes metrics per system for graphs and analysis

CREATE TABLE IF NOT EXISTS k8s_metrics_history (
  id SERIAL PRIMARY KEY,
  system_id INTEGER NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cluster_name VARCHAR(255),
  node_count INTEGER,
  node_ready INTEGER,
  pod_count INTEGER,
  pod_running INTEGER,
  pod_pending INTEGER,
  pod_failed INTEGER,
  cpu_usage_percent NUMERIC(5,2),
  memory_usage_percent NUMERIC(5,2),
  cpu_requests NUMERIC(10,2),
  cpu_limits NUMERIC(10,2),
  memory_requests NUMERIC(10,2),
  memory_limits NUMERIC(10,2),
  deployment_count INTEGER,
  deployment_ready INTEGER,
  service_count INTEGER,
  pvc_count INTEGER,
  pvc_bound INTEGER,
  namespaces TEXT,
  alerts TEXT,
  tenant_id INTEGER,
  application_id INTEGER,
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE
);

-- Indexes for efficient queries by system and time
CREATE INDEX IF NOT EXISTS idx_k8s_metrics_history_system_time
  ON k8s_metrics_history(system_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_k8s_metrics_history_timestamp
  ON k8s_metrics_history(timestamp DESC);
