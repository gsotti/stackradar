-- Add last_triggered_at to uptime_monitors
ALTER TABLE uptime_monitors ADD COLUMN last_triggered_at TIMESTAMP;
