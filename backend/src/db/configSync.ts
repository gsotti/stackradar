// Declarative YAML configuration sync engine for StackRadar.
// Reads a YAML config file and idempotently applies it to the database
// within a single transaction.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { Pool, PoolClient } from 'pg';
import { hashPassword } from '../middleware/auth.js';
import {
  StackRadarConfig,
  ConfigOrganization,
  validateConfig,
  resolveEnvVars,
} from './configSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Counters for the end-of-run summary
// ---------------------------------------------------------------------------

interface SyncCounts {
  orgsCreated: number;
  orgsUpdated: number;
  usersCreated: number;
  usersUpdated: number;
  usersDeactivated: number;
  tenantsCreated: number;
  tenantsUpdated: number;
  sitesCreated: number;
  sitesUpdated: number;
  envsCreated: number;
  envsUpdated: number;
  systemsCreated: number;
  monitorsCreated: number;
  monitorsUpdated: number;
  channelsCreated: number;
  channelsUpdated: number;
  alertRulesCreated: number;
  alertRulesUpdated: number;
  alertRulesDeleted: number;
  channelsDeleted: number;
  monitorsDeleted: number;
  smtpUpserted: number;
  smtpDeleted: number;
}

function zeroCounts(): SyncCounts {
  return {
    orgsCreated: 0,
    orgsUpdated: 0,
    usersCreated: 0,
    usersUpdated: 0,
    usersDeactivated: 0,
    tenantsCreated: 0,
    tenantsUpdated: 0,
    sitesCreated: 0,
    sitesUpdated: 0,
    envsCreated: 0,
    envsUpdated: 0,
    systemsCreated: 0,
    monitorsCreated: 0,
    monitorsUpdated: 0,
    channelsCreated: 0,
    channelsUpdated: 0,
    alertRulesCreated: 0,
    alertRulesUpdated: 0,
    alertRulesDeleted: 0,
    channelsDeleted: 0,
    monitorsDeleted: 0,
    smtpUpserted: 0,
    smtpDeleted: 0,
  };
}

// ---------------------------------------------------------------------------
// Main exported entry point
// ---------------------------------------------------------------------------

/**
 * Applies a declarative YAML config file to the database.
 *
 * Returns `true` when a config file was found and applied.
 * Returns `false` when no config file is present (caller falls back to
 * env-var seeding).
 *
 * Exits with code 1 on any error so that a bad config never silently
 * degrades into a partially-configured system.
 */
export async function applyConfig(pool: Pool): Promise<boolean> {
  // ------------------------------------------------------------------
  // 1. Locate the config file
  // ------------------------------------------------------------------
  let configPath: string;

  if (process.env.STACKRADAR_CONFIG) {
    configPath = process.env.STACKRADAR_CONFIG;
  } else {
    // __dirname is backend/src/db  →  ../../  =  backend/
    configPath = join(__dirname, '../../stackradar.config.yml');
  }

  if (!existsSync(configPath)) {
    return false;
  }

  console.log(`🔄 Config file found: ${configPath}`);

  // ------------------------------------------------------------------
  // 2. Parse and validate
  // ------------------------------------------------------------------
  let raw: unknown;
  try {
    raw = yaml.load(readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('❌ Failed to parse config YAML:', err);
    process.exit(1);
  }

  let config = raw as StackRadarConfig;

  try {
    validateConfig(config);
  } catch (err) {
    console.error('❌ Config validation failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    config = resolveEnvVars(config);
  } catch (err) {
    console.error('❌ Config env-var resolution failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ------------------------------------------------------------------
  // 3. Apply inside a single transaction
  // ------------------------------------------------------------------
  const client = await (pool as any).connect() as PoolClient;
  const counts = zeroCounts();

  try {
    await client.query('BEGIN');

    for (const org of config.organizations) {
      await syncOrganization(client, org, counts);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Config sync failed — transaction rolled back:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    client.release();
  }

  // ------------------------------------------------------------------
  // 4. Summary
  // ------------------------------------------------------------------
  console.log('✅ Config sync complete.');
  console.log(`   Organizations : ${counts.orgsCreated} created, ${counts.orgsUpdated} updated`);
  console.log(`   Users         : ${counts.usersCreated} created, ${counts.usersUpdated} updated, ${counts.usersDeactivated} deactivated`);
  console.log(`   Tenants       : ${counts.tenantsCreated} created, ${counts.tenantsUpdated} updated`);
  console.log(`   Sites         : ${counts.sitesCreated} created, ${counts.sitesUpdated} updated`);
  console.log(`   Environments  : ${counts.envsCreated} created, ${counts.envsUpdated} updated`);
  console.log(`   Systems       : ${counts.systemsCreated} created`);
  console.log(`   Uptime mons   : ${counts.monitorsCreated} created, ${counts.monitorsUpdated} updated, ${counts.monitorsDeleted} deleted`);
  console.log(`   Notif channels: ${counts.channelsCreated} created, ${counts.channelsUpdated} updated, ${counts.channelsDeleted} deleted`);
  console.log(`   Alert rules   : ${counts.alertRulesCreated} created, ${counts.alertRulesUpdated} updated, ${counts.alertRulesDeleted} deleted`);
  console.log(`   SMTP          : ${counts.smtpUpserted} upserted, ${counts.smtpDeleted} deleted`);

  return true;
}

// ---------------------------------------------------------------------------
// Per-organization sync
// ---------------------------------------------------------------------------

async function syncOrganization(
  client: PoolClient,
  org: ConfigOrganization,
  counts: SyncCounts,
): Promise<void> {
  console.log(`🔄 Syncing organization: ${org.name}`);

  // ------------------------------------------------------------------
  // Step 1: Organizations — find-or-create, no unique constraint on name
  // ------------------------------------------------------------------
  const orgRes = await client.query<{ id: number }>(
    'SELECT id FROM organizations WHERE name = $1 LIMIT 1',
    [org.name],
  );

  let orgId: number;
  if (orgRes.rows.length > 0) {
    orgId = orgRes.rows[0].id;
    await client.query(
      'UPDATE organizations SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [org.description ?? null, orgId],
    );
    counts.orgsUpdated++;
  } else {
    const ins = await client.query<{ id: number }>(
      'INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING id',
      [org.name, org.description ?? null],
    );
    orgId = ins.rows[0].id;
    counts.orgsCreated++;
  }

  // ------------------------------------------------------------------
  // Step 2: Users — upsert by email
  // ------------------------------------------------------------------
  // email → userId for later tenant-link step
  const userIdByEmail = new Map<string, number>();
  const managedUserIds: number[] = [];

  for (const user of org.users ?? []) {
    const passwordHash = hashPassword(user.password);
    const globalRole = user.global_role ?? null;

    const existing = await client.query<{ id: number; global_role: string | null }>(
      'SELECT id, global_role FROM users WHERE email = $1',
      [user.email.toLowerCase()],
    );

    let userId: number;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await client.query(
        `UPDATE users
            SET name            = $1,
                password_hash   = $2,
                global_role     = $3,
                organization_id = $4,
                is_active       = true,
                is_approved     = true,
                updated_at      = CURRENT_TIMESTAMP
          WHERE id = $5`,
        [user.name, passwordHash, globalRole, orgId, userId],
      );
      counts.usersUpdated++;
    } else {
      const ins = await client.query<{ id: number }>(
        `INSERT INTO users
           (email, password_hash, name, global_role, organization_id, is_active, is_approved)
         VALUES ($1, $2, $3, $4, $5, true, true)
         RETURNING id`,
        [user.email.toLowerCase(), passwordHash, user.name, globalRole, orgId],
      );
      userId = ins.rows[0].id;
      counts.usersCreated++;
    }

    userIdByEmail.set(user.email.toLowerCase(), userId);
    managedUserIds.push(userId);
  }

  // ------------------------------------------------------------------
  // Step 3: Tenants — upsert by (name, organization_id)
  // ------------------------------------------------------------------
  const tenantIdByName = new Map<string, number>();
  const managedTenantIds: number[] = [];

  for (const tenant of org.tenants ?? []) {
    const existing = await client.query<{ id: number }>(
      'SELECT id FROM tenants WHERE name = $1 AND organization_id = $2',
      [tenant.name, orgId],
    );

    let tenantId: number;
    if (existing.rows.length > 0) {
      tenantId = existing.rows[0].id;
      await client.query(
        'UPDATE tenants SET description = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [tenant.description ?? null, tenantId],
      );
      counts.tenantsUpdated++;
    } else {
      const ins = await client.query<{ id: number }>(
        'INSERT INTO tenants (name, description, organization_id) VALUES ($1, $2, $3) RETURNING id',
        [tenant.name, tenant.description ?? null, orgId],
      );
      tenantId = ins.rows[0].id;
      counts.tenantsCreated++;
    }

    tenantIdByName.set(tenant.name, tenantId);
    managedTenantIds.push(tenantId);
  }

  // ------------------------------------------------------------------
  // Step 4: User-tenant links — sync roles (full replace per user)
  // ------------------------------------------------------------------
  for (const user of org.users ?? []) {
    const userId = userIdByEmail.get(user.email.toLowerCase());
    if (userId === undefined) continue;

    // Collect the tenant IDs this user should be linked to
    const desiredTenantIds: number[] = [];
    for (const tenantRef of user.tenants ?? []) {
      const tenantId = tenantIdByName.get(tenantRef.tenant);
      if (tenantId === undefined) continue;
      desiredTenantIds.push(tenantId);
    }

    // Remove any user_tenants links NOT in the config for this user
    if (desiredTenantIds.length > 0) {
      await client.query(
        `DELETE FROM user_tenants WHERE user_id = $1 AND tenant_id != ALL($2)`,
        [userId, desiredTenantIds],
      );
    } else {
      // User has no tenant assignments — remove all links
      await client.query(
        `DELETE FROM user_tenants WHERE user_id = $1`,
        [userId],
      );
    }

    // Upsert the desired links
    for (const tenantRef of user.tenants ?? []) {
      const tenantId = tenantIdByName.get(tenantRef.tenant);
      if (tenantId === undefined) continue;

      await client.query(
        `INSERT INTO user_tenants (user_id, tenant_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = EXCLUDED.role`,
        [userId, tenantId, tenantRef.role],
      );
    }
  }

  // ------------------------------------------------------------------
  // Steps 5–10: Sites and their children
  // ------------------------------------------------------------------
  const managedSiteIds: number[] = [];
  const managedMonitorIds: number[] = [];
  const managedChannelIds: number[] = [];
  const managedAlertRuleIds: number[] = [];

  // monitorId lookup per site: `${siteName}/${monitorName}` → id
  const monitorIdBySiteAndName = new Map<string, number>();
  // channelId lookup per site: `${siteName}/${channelName}` → id
  const channelIdBySiteAndName = new Map<string, number>();

  for (const tenant of org.tenants ?? []) {
    const tenantId = tenantIdByName.get(tenant.name);
    if (tenantId === undefined) continue;

    for (const site of tenant.sites ?? []) {
      // ----------------------------------------------------------------
      // Step 5: Sites — upsert by (name, tenant_id)
      // ----------------------------------------------------------------
      const existingSite = await client.query<{ id: number }>(
        'SELECT id FROM sites WHERE name = $1 AND tenant_id = $2',
        [site.name, tenantId],
      );

      let siteId: number;
      if (existingSite.rows.length > 0) {
        siteId = existingSite.rows[0].id;

        // Check whether the desired api_token belongs to a *different* site
        const tokenConflict = await client.query<{ id: number }>(
          'SELECT id FROM sites WHERE api_token = $1 AND id != $2',
          [site.api_token, siteId],
        );
        if (tokenConflict.rows.length > 0) {
          throw new Error(
            `api_token "${site.api_token}" (site "${site.name}") is already in use by site id ${tokenConflict.rows[0].id}.`,
          );
        }

        await client.query(
          `UPDATE sites
              SET description   = $1,
                  api_token     = $2,
                  site_type     = $3,
                  retention_days= $4,
                  has_metrics   = $5,
                  updated_at    = CURRENT_TIMESTAMP
            WHERE id = $6`,
          [
            site.description ?? null,
            site.api_token,
            site.site_type ?? 'generic',
            site.retention_days ?? 30,
            site.has_metrics ?? true,
            siteId,
          ],
        );
        counts.sitesUpdated++;
      } else {
        // The api_token column has a UNIQUE constraint — a conflict here
        // means the token is already used by a completely different site
        // (different name AND different tenant).  Treat as fatal.
        try {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO sites (tenant_id, name, description, api_token, site_type, retention_days, has_metrics)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              tenantId,
              site.name,
              site.description ?? null,
              site.api_token,
              site.site_type ?? 'generic',
              site.retention_days ?? 30,
              site.has_metrics ?? true,
            ],
          );
          siteId = ins.rows[0].id;
          counts.sitesCreated++;
        } catch (err: any) {
          if (err?.code === '23505') {
            // unique_violation on api_token
            throw new Error(
              `api_token "${site.api_token}" (site "${site.name}") already exists on a different site. ` +
              `Each api_token must be globally unique.`,
            );
          }
          throw err;
        }
      }

      managedSiteIds.push(siteId);

      // ----------------------------------------------------------------
      // Step 6: Environments — upsert by (name, site_id)
      // ----------------------------------------------------------------
      for (const env of site.environments ?? []) {
        const existingEnv = await client.query<{ id: number }>(
          'SELECT id FROM environments WHERE name = $1 AND site_id = $2',
          [env.name, siteId],
        );

        let envId: number;
        if (existingEnv.rows.length > 0) {
          envId = existingEnv.rows[0].id;
          await client.query(
            'UPDATE environments SET display_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [env.display_name ?? null, envId],
          );
          counts.envsUpdated++;
        } else {
          const ins = await client.query<{ id: number }>(
            'INSERT INTO environments (site_id, name, display_name) VALUES ($1, $2, $3) RETURNING id',
            [siteId, env.name, env.display_name ?? null],
          );
          envId = ins.rows[0].id;
          counts.envsCreated++;
        }

        // ----------------------------------------------------------------
        // Step 7: Systems — upsert by (name, environment_id)
        // ----------------------------------------------------------------
        for (const sys of env.systems ?? []) {
          const existingSys = await client.query<{ id: number }>(
            'SELECT id FROM systems WHERE name = $1 AND environment_id = $2',
            [sys.name, envId],
          );

          if (existingSys.rows.length === 0) {
            await client.query(
              'INSERT INTO systems (environment_id, name) VALUES ($1, $2)',
              [envId, sys.name],
            );
            counts.systemsCreated++;
          }
          // No updatable fields beyond name — no-op if already exists.
        }
      }

      // ----------------------------------------------------------------
      // Step 8: Uptime monitors — upsert by (name, site_id)
      // ----------------------------------------------------------------
      for (const monitor of site.uptime_monitors ?? []) {
        const existingMon = await client.query<{ id: number }>(
          'SELECT id FROM uptime_monitors WHERE name = $1 AND site_id = $2',
          [monitor.name, siteId],
        );

        let monitorId: number;
        if (existingMon.rows.length > 0) {
          monitorId = existingMon.rows[0].id;
          await client.query(
            `UPDATE uptime_monitors
                SET url               = $1,
                    method            = $2,
                    interval_seconds  = $3,
                    expected_status   = $4,
                    is_main           = $5,
                    timeout_ms        = $6,
                    failure_threshold = $7,
                    updated_at        = CURRENT_TIMESTAMP
              WHERE id = $8`,
            [
              monitor.url,
              monitor.method ?? 'GET',
              monitor.interval_seconds ?? 300,
              monitor.expected_status ?? 200,
              monitor.is_main ?? false,
              (monitor as any).timeout_ms ?? 10000,
              (monitor as any).failure_threshold ?? 3,
              monitorId,
            ],
          );
          counts.monitorsUpdated++;
        } else {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO uptime_monitors
               (site_id, name, url, method, interval_seconds, expected_status, is_main, timeout_ms, failure_threshold, enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
              siteId,
              monitor.name,
              monitor.url,
              monitor.method ?? 'GET',
              monitor.interval_seconds ?? 300,
              monitor.expected_status ?? 200,
              monitor.is_main ?? false,
              (monitor as any).timeout_ms ?? 10000,
              (monitor as any).failure_threshold ?? 3,
              (monitor as any).enabled ?? true,
            ],
          );
          monitorId = ins.rows[0].id;
          counts.monitorsCreated++;
        }

        managedMonitorIds.push(monitorId);
        monitorIdBySiteAndName.set(`${site.name}/${monitor.name}`, monitorId);
      }

      // ----------------------------------------------------------------
      // Step 9: Notification channels — upsert by (name, site_id)
      // ----------------------------------------------------------------
      for (const channel of site.notification_channels ?? []) {
        const existingCh = await client.query<{ id: number }>(
          'SELECT id FROM notification_channels WHERE name = $1 AND site_id = $2',
          [channel.name, siteId],
        );

        const webhookHeaders = channel.webhook_headers
          ? JSON.stringify(channel.webhook_headers)
          : null;

        let channelId: number;
        if (existingCh.rows.length > 0) {
          channelId = existingCh.rows[0].id;
          await client.query(
            `UPDATE notification_channels
                SET channel_type      = $1,
                    email_recipients  = $2,
                    webhook_url       = $3,
                    webhook_headers   = $4,
                    enabled           = $5,
                    updated_at        = CURRENT_TIMESTAMP
              WHERE id = $6`,
            [
              channel.channel_type,
              channel.email_recipients ?? null,
              channel.webhook_url ?? null,
              webhookHeaders,
              (channel as any).enabled ?? true,
              channelId,
            ],
          );
          counts.channelsUpdated++;
        } else {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO notification_channels
               (site_id, name, channel_type, email_recipients, webhook_url, webhook_headers, enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              siteId,
              channel.name,
              channel.channel_type,
              channel.email_recipients ?? null,
              channel.webhook_url ?? null,
              webhookHeaders,
              (channel as any).enabled ?? true,
            ],
          );
          channelId = ins.rows[0].id;
          counts.channelsCreated++;
        }

        managedChannelIds.push(channelId);
        channelIdBySiteAndName.set(`${site.name}/${channel.name}`, channelId);
      }

      // ----------------------------------------------------------------
      // Step 10: Alert rules — upsert by (name, site_id)
      // ----------------------------------------------------------------
      for (const rule of site.alert_rules ?? []) {
        // Resolve monitor reference
        let monitorId: number | null = null;
        if (rule.monitor) {
          monitorId = monitorIdBySiteAndName.get(`${site.name}/${rule.monitor}`) ?? null;
        }

        const existingRule = await client.query<{ id: number }>(
          'SELECT id FROM alert_rules WHERE name = $1 AND site_id = $2',
          [rule.name, siteId],
        );

        let alertRuleId: number;
        if (existingRule.rows.length > 0) {
          alertRuleId = existingRule.rows[0].id;
          await client.query(
            `UPDATE alert_rules
                SET alert_type          = $1,
                    metric_type         = $2,
                    threshold_operator  = $3,
                    threshold_value     = $4,
                    time_window_minutes = $5,
                    cooldown_minutes    = $6,
                    failure_threshold   = $7,
                    repeat_interval_hours = $8,
                    severity            = $9,
                    monitor_id          = $10,
                    enabled             = $11,
                    updated_at          = CURRENT_TIMESTAMP
              WHERE id = $12`,
            [
              rule.alert_type ?? 'metric',
              rule.metric_type ?? null,
              rule.threshold_operator ?? null,
              rule.threshold_value ?? null,
              (rule as any).time_window_minutes ?? 5,
              (rule as any).cooldown_minutes ?? 30,
              (rule as any).failure_threshold ?? 3,
              (rule as any).repeat_interval_hours ?? 1,
              rule.severity ?? 'warning',
              monitorId,
              (rule as any).enabled ?? true,
              alertRuleId,
            ],
          );
          counts.alertRulesUpdated++;
        } else {
          const ins = await client.query<{ id: number }>(
            `INSERT INTO alert_rules
               (site_id, name, alert_type, metric_type, threshold_operator, threshold_value,
                time_window_minutes, cooldown_minutes, failure_threshold, repeat_interval_hours,
                severity, monitor_id, enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING id`,
            [
              siteId,
              rule.name,
              rule.alert_type ?? 'metric',
              rule.metric_type ?? null,
              rule.threshold_operator ?? null,
              rule.threshold_value ?? null,
              (rule as any).time_window_minutes ?? 5,
              (rule as any).cooldown_minutes ?? 30,
              (rule as any).failure_threshold ?? 3,
              (rule as any).repeat_interval_hours ?? 1,
              rule.severity ?? 'warning',
              monitorId,
              (rule as any).enabled ?? true,
            ],
          );
          alertRuleId = ins.rows[0].id;
          counts.alertRulesCreated++;
        }

        managedAlertRuleIds.push(alertRuleId);

        // Sync alert_rule_channels: replace all existing links
        await client.query(
          'DELETE FROM alert_rule_channels WHERE alert_rule_id = $1',
          [alertRuleId],
        );

        for (const channelName of rule.notification_channels ?? []) {
          const channelId = channelIdBySiteAndName.get(`${site.name}/${channelName}`);
          if (channelId === undefined) continue; // validated earlier

          await client.query(
            `INSERT INTO alert_rule_channels (alert_rule_id, notification_channel_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [alertRuleId, channelId],
          );
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Step 11: SMTP config — upsert by organization_id
  // ------------------------------------------------------------------
  if (org.smtp) {
    const smtp = org.smtp;
    const existingSmtp = await client.query<{ id: number }>(
      'SELECT id FROM smtp_config WHERE organization_id = $1',
      [orgId],
    );

    if (existingSmtp.rows.length > 0) {
      await client.query(
        `UPDATE smtp_config
            SET host          = $1,
                port          = $2,
                secure        = $3,
                auth_user     = $4,
                auth_password = $5,
                from_email    = $6,
                from_name     = $7,
                updated_at    = CURRENT_TIMESTAMP
          WHERE organization_id = $8`,
        [
          smtp.host,
          smtp.port,
          smtp.secure ?? false,
          smtp.auth_user ?? null,
          smtp.auth_password ?? null,
          smtp.from_email,
          smtp.from_name ?? 'StackRadar Alerts',
          orgId,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO smtp_config
           (organization_id, host, port, secure, auth_user, auth_password, from_email, from_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orgId,
          smtp.host,
          smtp.port,
          smtp.secure ?? false,
          smtp.auth_user ?? null,
          smtp.auth_password ?? null,
          smtp.from_email,
          smtp.from_name ?? 'StackRadar Alerts',
        ],
      );
    }
    counts.smtpUpserted++;
  } else {
    // No SMTP in config for this org — remove any existing row
    const deleted = await client.query(
      'DELETE FROM smtp_config WHERE organization_id = $1 RETURNING id',
      [orgId],
    );
    if (deleted.rowCount && deleted.rowCount > 0) {
      counts.smtpDeleted++;
    }
  }

  // ------------------------------------------------------------------
  // Step 12: Orphan removal
  // ------------------------------------------------------------------

  // Alert rules not in config (within managed sites)
  if (managedSiteIds.length > 0) {
    const orphanRules = await client.query<{ id: number }>(
      `DELETE FROM alert_rules
        WHERE site_id = ANY($1)
          AND id != ALL($2)
        RETURNING id`,
      [
        managedSiteIds,
        managedAlertRuleIds.length > 0 ? managedAlertRuleIds : [-1],
      ],
    );
    counts.alertRulesDeleted += orphanRules.rowCount ?? 0;

    // Notification channels not in config
    const orphanChannels = await client.query<{ id: number }>(
      `DELETE FROM notification_channels
        WHERE site_id = ANY($1)
          AND id != ALL($2)
        RETURNING id`,
      [
        managedSiteIds,
        managedChannelIds.length > 0 ? managedChannelIds : [-1],
      ],
    );
    counts.channelsDeleted += orphanChannels.rowCount ?? 0;

    // Uptime monitors not in config
    const orphanMonitors = await client.query<{ id: number }>(
      `DELETE FROM uptime_monitors
        WHERE site_id = ANY($1)
          AND id != ALL($2)
        RETURNING id`,
      [
        managedSiteIds,
        managedMonitorIds.length > 0 ? managedMonitorIds : [-1],
      ],
    );
    counts.monitorsDeleted += orphanMonitors.rowCount ?? 0;
  }

  // User-tenant links for tenants that are in this org but NOT in config
  // (i.e. tenants the config no longer manages)
  if (managedTenantIds.length > 0) {
    await client.query(
      `DELETE FROM user_tenants
        WHERE tenant_id IN (
          SELECT id FROM tenants
           WHERE organization_id = $1
             AND id != ALL($2)
        )`,
      [orgId, managedTenantIds],
    );
  } else {
    // No tenants managed — remove all user-tenant links for tenants of this org
    await client.query(
      `DELETE FROM user_tenants
        WHERE tenant_id IN (
          SELECT id FROM tenants WHERE organization_id = $1
        )`,
      [orgId],
    );
  }

  // Deactivate users in this org that are no longer in config; never touch superadmins
  if (managedUserIds.length > 0) {
    const deactivated = await client.query<{ id: number }>(
      `UPDATE users
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $1
          AND id != ALL($2)
          AND (global_role IS NULL OR global_role != 'superadmin')
        RETURNING id`,
      [orgId, managedUserIds],
    );
    counts.usersDeactivated += deactivated.rowCount ?? 0;

    // Remove their tenant memberships too
    await client.query(
      `DELETE FROM user_tenants
        WHERE user_id IN (
          SELECT id FROM users
           WHERE organization_id = $1
             AND id != ALL($2)
             AND (global_role IS NULL OR global_role != 'superadmin')
        )`,
      [orgId, managedUserIds],
    );
  } else {
    // No users managed — deactivate all non-superadmin users in org
    const deactivated = await client.query<{ id: number }>(
      `UPDATE users
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $1
          AND (global_role IS NULL OR global_role != 'superadmin')
        RETURNING id`,
      [orgId],
    );
    counts.usersDeactivated += deactivated.rowCount ?? 0;
  }

  console.log(`✅ Organization "${org.name}" synced (id=${orgId})`);
}
