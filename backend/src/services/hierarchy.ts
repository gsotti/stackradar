import { PoolClient } from 'pg';

/**
 * Resolves or creates an application for a given system.
 * Returns the application ID.
 * New hierarchy: Application belongs to System
 */
export async function resolveApplicationId(
  client: PoolClient,
  systemId: number,
  applicationName: string | null | undefined
): Promise<number> {
  // Default value
  const name = applicationName?.trim() || 'unknown';

  // Try to find existing application
  const result = await client.query(
    `SELECT id FROM applications
     WHERE system_id = $1 AND name = $2`,
    [systemId, name]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Create new application if it doesn't exist
  try {
    const insertResult = await client.query(
      `INSERT INTO applications (system_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [systemId, name, 'Auto-created from log/metrics ingestion']
    );
    return insertResult.rows[0].id;
  } catch (error: any) {
    // Handle race condition: another process might have created it
    if (error.code === '23505') {
      const retryResult = await client.query(
        `SELECT id FROM applications WHERE system_id = $1 AND name = $2`,
        [systemId, name]
      );
      if (retryResult.rows.length > 0) {
        return retryResult.rows[0].id;
      }
    }
    throw error;
  }
}

/**
 * Resolves or creates an environment for a given application.
 * Returns the environment ID.
 * New hierarchy: Environment belongs to Application
 */
export async function resolveEnvironmentId(
  client: PoolClient,
  applicationId: number,
  environmentName: string | null | undefined
): Promise<number> {
  const name = environmentName?.trim() || 'unknown';

  // Try to find existing environment
  const existing = await client.query(
    'SELECT id FROM environments WHERE application_id = $1 AND name = $2',
    [applicationId, name]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // Create if not exists (unique on (application_id, name))
  const inserted = await client.query(
    `INSERT INTO environments (application_id, name)
     VALUES ($1, $2)
     ON CONFLICT (application_id, name)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [applicationId, name]
  );
  return inserted.rows[0].id;
}

/**
 * Resolves hierarchy for a system: application and environment.
 * Returns environment_id and application_id.
 * New hierarchy: System -> Application -> Environment
 */
export async function resolveHierarchy(
  client: PoolClient,
  systemId: number,
  environmentName: string | null | undefined,
  applicationName: string | null | undefined
): Promise<{ environmentId: number; applicationId: number }> {
  // Resolve application first (from system), then environment (from application)
  const applicationId = await resolveApplicationId(client, systemId, applicationName);
  const environmentId = await resolveEnvironmentId(client, applicationId, environmentName);

  return { environmentId, applicationId };
}
