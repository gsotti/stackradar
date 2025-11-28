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
    const retentionDate = new Date(Date.now() - system.retention_days * 24 * 60 * 60 * 1000);

    const result = await db.query<{ deleted_count: string }>(
      `WITH deleted AS (
         DELETE FROM log_entries
         WHERE system_id = $1
         AND timestamp < $2
         RETURNING *
       )
       SELECT COUNT(*)::text as deleted_count FROM deleted`,
      [system.id, retentionDate.toISOString()]
    );

    totalDeleted += parseInt(result.rows[0]?.deleted_count || '0');
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
