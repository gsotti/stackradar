CREATE TABLE IF NOT EXISTS lambda_metrics (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  function_name VARCHAR(255) NOT NULL,
  invocations INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  throttles INTEGER DEFAULT 0,
  avg_duration_ms REAL DEFAULT 0,
  max_duration_ms REAL DEFAULT 0,
  concurrent_executions INTEGER DEFAULT 0,
  iterator_age_ms REAL DEFAULT 0,
  memory_size_mb INTEGER DEFAULT 0,
  timeout_seconds INTEGER DEFAULT 0,
  runtime VARCHAR(50),
  last_modified TIMESTAMPTZ,
  tenant_id INTEGER REFERENCES tenants(id),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, function_name)
);

CREATE TABLE IF NOT EXISTS lambda_metrics_history (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  function_name VARCHAR(255) NOT NULL,
  invocations INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  throttles INTEGER DEFAULT 0,
  avg_duration_ms REAL DEFAULT 0,
  max_duration_ms REAL DEFAULT 0,
  concurrent_executions INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lambda_metrics_site ON lambda_metrics(site_id);
CREATE INDEX idx_lambda_metrics_history_site_ts ON lambda_metrics_history(site_id, timestamp);
