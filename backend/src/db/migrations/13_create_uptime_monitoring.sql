-- Create uptime monitoring tables

CREATE TABLE uptime_monitors (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  method VARCHAR(10) DEFAULT 'GET',
  interval_seconds INTEGER DEFAULT 300,
  timeout_ms INTEGER DEFAULT 10000,
  expected_status INTEGER DEFAULT 200,
  failure_threshold INTEGER DEFAULT 3,
  is_main BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  current_status VARCHAR(10) DEFAULT 'unknown',
  consecutive_failures INTEGER DEFAULT 0,
  last_status_change TIMESTAMP,
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE uptime_checks (
  id SERIAL PRIMARY KEY,
  monitor_id INTEGER NOT NULL REFERENCES uptime_monitors(id) ON DELETE CASCADE,
  status VARCHAR(10) NOT NULL,
  response_time_ms INTEGER,
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX idx_uptime_monitors_site_id ON uptime_monitors(site_id);
CREATE INDEX idx_uptime_monitors_enabled ON uptime_monitors(enabled) WHERE enabled = true;
CREATE INDEX idx_uptime_monitors_is_main ON uptime_monitors(site_id, is_main) WHERE is_main = true;
CREATE INDEX idx_uptime_checks_monitor_id ON uptime_checks(monitor_id);
CREATE INDEX idx_uptime_checks_checked_at ON uptime_checks(checked_at);
CREATE INDEX idx_uptime_checks_monitor_checked ON uptime_checks(monitor_id, checked_at DESC);

-- Ensure only one main monitor per site
CREATE UNIQUE INDEX idx_uptime_monitors_unique_main ON uptime_monitors(site_id) WHERE is_main = true;
