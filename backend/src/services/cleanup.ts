import db from '../db/database.js';
import { Site } from '../types/index.js';

export async function cleanupOldLogs(): Promise<number> {
  // Get all sites with their retention settings
  const sitesResult = await db.query<Pick<Site, 'id' | 'retention_days'>>(
    'SELECT id, retention_days FROM sites'
  );
  const sites = sitesResult.rows;

  let totalDeleted = 0;

  for (const site of sites) {
    const days = Number(site.retention_days ?? 0);
    if (!Number.isFinite(days) || days <= 0) {
      // Skip sites without a positive retention policy
      continue;
    }
    const retentionDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.query<{ deleted_count: string }>(
      `WITH deleted AS (
         DELETE FROM log_entries le
         WHERE le.timestamp < $2
           AND EXISTS (
             SELECT 1 FROM systems s
             INNER JOIN environments e ON e.id = s.environment_id
             WHERE s.id = le.system_id
               AND e.site_id = $1
           )
         RETURNING le.*
       )
       SELECT COUNT(*)::text as deleted_count FROM deleted`,
      [site.id, retentionDate.toISOString()]
    );

    totalDeleted += parseInt(result.rows[0]?.deleted_count || '0');

    // Cleanup site metrics history for this site
    const historyResult = await db.query<{ deleted_count: string }>(
      `WITH deleted AS (
         DELETE FROM site_metrics_history h
         WHERE h.site_id = $1
         AND h.timestamp < $2
         RETURNING h.*
       )
       SELECT COUNT(*)::text as deleted_count FROM deleted`,
      [site.id, retentionDate.toISOString()]
    );

    totalDeleted += parseInt(historyResult.rows[0]?.deleted_count || '0');
  }

  return totalDeleted;
}

// CLI runner
if (process.argv[1].includes('cleanup')) {
  cleanupOldLogs()
    .then(deleted => {
      console.log(`Cleanup complete. Deleted ${deleted} old log entries.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}
