import { PoolClient } from 'pg';

/**
 * Resolves or creates a system for a given environment.
 * Returns the system ID.
 * New hierarchy: Tenant → Site → Environment → System
 */
export async function resolveSystemId(
  client: PoolClient,
  environmentId: number,
  systemName: string | null | undefined
): Promise<number> {
  // Default value
  const name = systemName?.trim() || 'unknown';

  // Try to find existing system
  const result = await client.query(
    `SELECT id FROM systems
     WHERE environment_id = $1 AND name = $2`,
    [environmentId, name]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Create new system if it doesn't exist
  try {
    const insertResult = await client.query(
      `INSERT INTO systems (environment_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [environmentId, name, 'Auto-created from log ingestion']
    );
    return insertResult.rows[0].id;
  } catch (error: any) {
    // Handle race condition: another process might have created it
    if (error.code === '23505') {
      const retryResult = await client.query(
        `SELECT id FROM systems WHERE environment_id = $1 AND name = $2`,
        [environmentId, name]
      );
      if (retryResult.rows.length > 0) {
        return retryResult.rows[0].id;
      }
    }
    throw error;
  }
}

/**
 * Resolves or creates an environment for a given site.
 * Returns the environment ID.
 * New hierarchy: Tenant → Site → Environment → System
 */
export async function resolveEnvironmentId(
  client: PoolClient,
  siteId: number,
  environmentName: string | null | undefined
): Promise<number> {
  const name = environmentName?.trim() || 'dev';

  // Try to find existing environment
  const existing = await client.query(
    'SELECT id FROM environments WHERE site_id = $1 AND name = $2',
    [siteId, name]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Create if not exists (unique on (site_id, name))
  const inserted = await client.query(
    `INSERT INTO environments (site_id, name)
     VALUES ($1, $2)
     ON CONFLICT (site_id, name)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [siteId, name]
  );
  return inserted.rows[0].id;
}

/**
 * Resolves hierarchy for a site: environment and system.
 * Returns environment_id and system_id.
 * New hierarchy: Tenant → Site → Environment → System
 *
 * Note: The siteId parameter is actually passed as the system_id from the API token,
 * but in the new structure it represents the site_id.
 */
export async function resolveHierarchy(
  client: PoolClient,
  siteId: number,
  environmentName: string | null | undefined,
  systemName: string | null | undefined
): Promise<{ environmentId: number; systemId: number }> {
  // Resolve environment first (from site), then system (from environment)
  const environmentId = await resolveEnvironmentId(client, siteId, environmentName);
  const systemId = await resolveSystemId(client, environmentId, systemName);

  return { environmentId, systemId };
}
