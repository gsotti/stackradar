CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value) VALUES
  ('registry_owner', 'gsotti'),
  ('app_url', '')
ON CONFLICT (key) DO NOTHING;
