-- Migration 09: Increase precision for CPU and memory usage percentages
-- Fix numeric overflow error when values exceed 999.99%

-- Handle both old name (k8s_metrics) and new name (site_metrics)
DO $$
BEGIN
  -- Check if site_metrics exists (after migration 07)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'site_metrics') THEN
    ALTER TABLE site_metrics
      ALTER COLUMN cpu_usage_percent TYPE DECIMAL(8,2),
      ALTER COLUMN memory_usage_percent TYPE DECIMAL(8,2);

    ALTER TABLE site_metrics_history
      ALTER COLUMN cpu_usage_percent TYPE DECIMAL(8,2),
      ALTER COLUMN memory_usage_percent TYPE DECIMAL(8,2);

  -- Otherwise use old name (k8s_metrics)
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'k8s_metrics') THEN
    ALTER TABLE k8s_metrics
      ALTER COLUMN cpu_usage_percent TYPE DECIMAL(8,2),
      ALTER COLUMN memory_usage_percent TYPE DECIMAL(8,2);

    ALTER TABLE k8s_metrics_history
      ALTER COLUMN cpu_usage_percent TYPE DECIMAL(8,2),
      ALTER COLUMN memory_usage_percent TYPE DECIMAL(8,2);
  END IF;
END $$;
