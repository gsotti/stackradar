-- Migration: Initial database schema
-- Description: Creates all base tables (users, systems, log_entries, k8s_metrics)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  is_approved BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Systems table
CREATE TABLE IF NOT EXISTS systems (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  api_token VARCHAR(255) UNIQUE NOT NULL,
  retention_days INTEGER DEFAULT 30,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Log entries table
CREATE TABLE IF NOT EXISTS log_entries (
  id SERIAL PRIMARY KEY,
  system_id INTEGER NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  level VARCHAR(50) DEFAULT 'INFO',
  message TEXT NOT NULL,
  source VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE
);

-- Create indexes for log queries
CREATE INDEX IF NOT EXISTS idx_logs_system_timestamp ON log_entries(system_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON log_entries(level);
CREATE INDEX IF NOT EXISTS idx_logs_source ON log_entries(source);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON log_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_system_id ON log_entries(system_id);

-- GIN index for full-text search on message
CREATE INDEX IF NOT EXISTS idx_logs_message_gin ON log_entries USING GIN (to_tsvector('english', message));

-- Kubernetes metrics table
CREATE TABLE IF NOT EXISTS k8s_metrics (
  id SERIAL PRIMARY KEY,
  system_id INTEGER UNIQUE NOT NULL,
  cluster_name VARCHAR(255),
  node_count INTEGER DEFAULT 0,
  node_ready INTEGER DEFAULT 0,
  pod_count INTEGER DEFAULT 0,
  pod_running INTEGER DEFAULT 0,
  pod_pending INTEGER DEFAULT 0,
  pod_failed INTEGER DEFAULT 0,
  cpu_usage_percent NUMERIC(5,2) DEFAULT 0,
  memory_usage_percent NUMERIC(5,2) DEFAULT 0,
  cpu_requests NUMERIC(10,2) DEFAULT 0,
  cpu_limits NUMERIC(10,2) DEFAULT 0,
  memory_requests NUMERIC(10,2) DEFAULT 0,
  memory_limits NUMERIC(10,2) DEFAULT 0,
  deployment_count INTEGER DEFAULT 0,
  deployment_ready INTEGER DEFAULT 0,
  service_count INTEGER DEFAULT 0,
  pvc_count INTEGER DEFAULT 0,
  pvc_bound INTEGER DEFAULT 0,
  namespaces TEXT,
  alerts TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (system_id) REFERENCES systems(id) ON DELETE CASCADE
);

-- Index for k8s metrics
CREATE INDEX IF NOT EXISTS idx_k8s_metrics_system_id ON k8s_metrics(system_id);
