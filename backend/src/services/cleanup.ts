import db from '../db/database.js';
import { System } from '../types/index.js';

export async function cleanupOldLogs(): Promise<number> {
  // Get all systems with their retention settings
  const systemsResult = await db.query<Pick<System, 'id' | 'retention_days'>>(
    'SELECT id, retention_days FROM systems'
  );
  const systems = systemsResult.rows;

  let totalDeleted = 0;

  for (const system of systems) {
    const days = Number(system.retention_days ?? 0);
    if (!Number.isFinite(days) || days <= 0) {
      // Skip systems without a positive retention policy
      continue;
    }
    const retentionDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.query<{ deleted_count: string }>(
      `WITH deleted AS (
         DELETE FROM log_entries le
         WHERE le.timestamp < $2
           AND EXISTS (
             SELECT 1 FROM environments e
             WHERE e.id = le.environment_id
               AND e.system_id = $1
           )
         RETURNING le.*
       )
       SELECT COUNT(*)::text as deleted_count FROM deleted`,
      [system.id, retentionDate.toISOString()]
    );

    totalDeleted += parseInt(result.rows[0]?.deleted_count || '0');

    // Cleanup k8s metrics history for this system
    const historyResult = await db.query<{ deleted_count: string }>(
      `WITH deleted AS (
         DELETE FROM k8s_metrics_history h
         WHERE h.system_id = $1
         AND h.timestamp < $2
         RETURNING h.*
       )
       SELECT COUNT(*)::text as deleted_count FROM deleted`,
      [system.id, retentionDate.toISOString()]
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
