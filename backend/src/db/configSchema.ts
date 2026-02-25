// Declarative YAML configuration schema for StackRadar.
// Provides TypeScript interfaces, validation, and environment variable resolution.

// ---------------------------------------------------------------------------
// Sub-interfaces
// ---------------------------------------------------------------------------

export interface ConfigSmtp {
  host: string;
  port: number;
  secure?: boolean;
  auth_user?: string;
  /** Supports ${ENV_VAR} substitution. */
  auth_password?: string;
  from_email: string;
  from_name?: string;
}

export interface ConfigUserTenantRef {
  /** References a tenant name defined in the same org's `tenants` array. */
  tenant: string;
  role: 'tenant_admin' | 'editor' | 'viewer';
}

export interface ConfigUser {
  email: string;
  name: string;
  /** Supports ${ENV_VAR} substitution. */
  password: string;
  /** Only `org_admin` is permitted when declaring users via config. */
  global_role?: 'org_admin';
  tenants: ConfigUserTenantRef[];
}

export interface ConfigSystem {
  name: string;
}

export interface ConfigEnvironment {
  name: string;
  display_name?: string;
  systems?: ConfigSystem[];
}

export interface ConfigUptimeMonitor {
  name: string;
  url: string;
  method?: 'GET' | 'HEAD' | 'POST';
  interval_seconds?: number;
  expected_status?: number;
  is_main?: boolean;
}

export interface ConfigNotificationChannel {
  name: string;
  channel_type: 'email' | 'webhook';
  email_recipients?: string[];
  /** Supports ${ENV_VAR} substitution. */
  webhook_url?: string;
  webhook_headers?: Record<string, string>;
}

export interface ConfigAlertRule {
  name: string;
  alert_type: 'metric' | 'uptime';
  metric_type?: string;
  threshold_operator?: string;
  threshold_value?: number;
  severity?: 'critical' | 'warning' | 'info';
  /** References names from the same site's `notification_channels` array. */
  notification_channels?: string[];
  /** References a name from the same site's `uptime_monitors` array. */
  monitor?: string;
}

export interface ConfigSite {
  name: string;
  description?: string;
  /** Supports ${ENV_VAR} substitution. */
  api_token: string;
  site_type?: 'docker' | 'kubernetes' | 'generic';
  retention_days?: number;
  has_metrics?: boolean;
  environments?: ConfigEnvironment[];
  uptime_monitors?: ConfigUptimeMonitor[];
  notification_channels?: ConfigNotificationChannel[];
  alert_rules?: ConfigAlertRule[];
}

export interface ConfigTenant {
  name: string;
  description?: string;
  sites: ConfigSite[];
}

export interface ConfigOrganization {
  name: string;
  description?: string;
  smtp?: ConfigSmtp;
  users: ConfigUser[];
  tenants: ConfigTenant[];
}

// ---------------------------------------------------------------------------
// Top-level config interface
// ---------------------------------------------------------------------------

export interface StackRadarConfig {
  organizations: ConfigOrganization[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a parsed StackRadarConfig, throwing a descriptive Error on the
 * first constraint violation found.
 *
 * Rules enforced:
 * - Required fields are present (org name, user fields, tenant name, site name/api_token).
 * - No duplicate user emails across all organisations.
 * - No duplicate api_tokens across all organisations.
 * - No duplicate tenant names within an organisation.
 * - No duplicate site names within a tenant.
 * - User tenant references resolve to a tenant declared in the same org.
 * - Alert rule channel references resolve to channels declared on the same site.
 * - Alert rule monitor references resolve to monitors declared on the same site.
 */
export function validateConfig(config: StackRadarConfig): void {
  if (!config.organizations || config.organizations.length === 0) {
    throw new Error('Config must define at least one organization.');
  }

  const globalEmails = new Set<string>();
  const globalTokens = new Set<string>();

  for (const org of config.organizations) {
    const orgContext = `Organization "${org.name}"`;

    if (!org.name || org.name.trim() === '') {
      throw new Error('Each organization must have a non-empty name.');
    }

    // ------------------------------------------------------------------
    // Users
    // ------------------------------------------------------------------
    if (!org.users || org.users.length === 0) {
      // Users are technically optional at the schema level but should be
      // present to create at least one admin.  We allow empty arrays.
    } else {
      for (const user of org.users) {
        const userContext = `${orgContext} > user "${user.email}"`;

        if (!user.email || user.email.trim() === '') {
          throw new Error(`${orgContext}: A user is missing the required "email" field.`);
        }
        if (!user.name || user.name.trim() === '') {
          throw new Error(`${userContext}: Missing required "name" field.`);
        }
        if (!user.password || user.password.trim() === '') {
          throw new Error(`${userContext}: Missing required "password" field.`);
        }

        const normalisedEmail = user.email.toLowerCase();
        if (globalEmails.has(normalisedEmail)) {
          throw new Error(`Duplicate user email "${user.email}" found across organizations.`);
        }
        globalEmails.add(normalisedEmail);
      }
    }

    // ------------------------------------------------------------------
    // Tenants
    // ------------------------------------------------------------------
    if (!org.tenants || org.tenants.length === 0) {
      // Allow empty tenant list.
    } else {
      const tenantNamesInOrg = new Set<string>();
      const tenantNameSet = new Set<string>(org.tenants.map(t => t.name));

      for (const tenant of org.tenants) {
        const tenantContext = `${orgContext} > tenant "${tenant.name}"`;

        if (!tenant.name || tenant.name.trim() === '') {
          throw new Error(`${orgContext}: A tenant is missing the required "name" field.`);
        }

        if (tenantNamesInOrg.has(tenant.name)) {
          throw new Error(`${orgContext}: Duplicate tenant name "${tenant.name}".`);
        }
        tenantNamesInOrg.add(tenant.name);

        // Sites
        if (tenant.sites && tenant.sites.length > 0) {
          const siteNamesInTenant = new Set<string>();

          for (const site of tenant.sites) {
            const siteContext = `${tenantContext} > site "${site.name}"`;

            if (!site.name || site.name.trim() === '') {
              throw new Error(`${tenantContext}: A site is missing the required "name" field.`);
            }
            if (!site.api_token || site.api_token.trim() === '') {
              throw new Error(`${siteContext}: Missing required "api_token" field.`);
            }

            if (siteNamesInTenant.has(site.name)) {
              throw new Error(`${tenantContext}: Duplicate site name "${site.name}".`);
            }
            siteNamesInTenant.add(site.name);

            // api_token uniqueness (after env-var resolution happens separately;
            // we check raw values here, which catches literal duplicates).
            if (globalTokens.has(site.api_token)) {
              throw new Error(
                `Duplicate api_token "${site.api_token}" found in ${siteContext}.`
              );
            }
            globalTokens.add(site.api_token);

            // Collect channel and monitor names for cross-reference checks.
            const channelNames = new Set<string>(
              (site.notification_channels ?? []).map(c => c.name)
            );
            const monitorNames = new Set<string>(
              (site.uptime_monitors ?? []).map(m => m.name)
            );

            // Alert rule references
            for (const rule of site.alert_rules ?? []) {
              const ruleContext = `${siteContext} > alert_rule "${rule.name}"`;

              for (const channelRef of rule.notification_channels ?? []) {
                if (!channelNames.has(channelRef)) {
                  throw new Error(
                    `${ruleContext}: notification_channel "${channelRef}" does not exist on this site.`
                  );
                }
              }

              if (rule.monitor !== undefined && !monitorNames.has(rule.monitor)) {
                throw new Error(
                  `${ruleContext}: monitor "${rule.monitor}" does not exist on this site.`
                );
              }
            }
          }
        }
      }

      // User tenant references
      for (const user of org.users ?? []) {
        for (const tenantRef of user.tenants ?? []) {
          if (!tenantNameSet.has(tenantRef.tenant)) {
            throw new Error(
              `${orgContext} > user "${user.email}": tenant reference "${tenantRef.tenant}" does not exist in this organization.`
            );
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Environment variable resolution
// ---------------------------------------------------------------------------

const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Resolves a single `${VAR}` expression within a string value.
 * All occurrences of `${VAR}` in `value` are replaced with the corresponding
 * process.env entry.  Throws if any referenced variable is not set.
 */
function resolveString(value: string, fieldDescription: string): string {
  return value.replace(ENV_VAR_PATTERN, (_match, varName: string) => {
    const resolved = process.env[varName];
    if (resolved === undefined) {
      throw new Error(
        `Environment variable "${varName}" is not set (required by ${fieldDescription}).`
      );
    }
    return resolved;
  });
}

/**
 * Deep-clones the provided StackRadarConfig and resolves all `${ENV_VAR}`
 * patterns in the fields that support substitution:
 *   - `user.password`
 *   - `site.api_token`
 *   - `smtp.auth_password`
 *   - `notification_channel.webhook_url`
 *
 * Throws a descriptive Error if any referenced environment variable is not set.
 */
export function resolveEnvVars(config: StackRadarConfig): StackRadarConfig {
  // Deep-clone via JSON round-trip (config contains only plain JSON-compatible
  // values — no Date objects, functions, or circular references).
  const cloned: StackRadarConfig = JSON.parse(JSON.stringify(config)) as StackRadarConfig;

  for (const org of cloned.organizations) {
    // SMTP auth_password
    if (org.smtp?.auth_password !== undefined) {
      org.smtp.auth_password = resolveString(
        org.smtp.auth_password,
        `organization "${org.name}" > smtp.auth_password`
      );
    }

    // User passwords
    for (const user of org.users ?? []) {
      user.password = resolveString(
        user.password,
        `organization "${org.name}" > user "${user.email}" > password`
      );
    }

    // Site api_tokens and notification channel webhook_urls
    for (const tenant of org.tenants ?? []) {
      for (const site of tenant.sites ?? []) {
        site.api_token = resolveString(
          site.api_token,
          `organization "${org.name}" > tenant "${tenant.name}" > site "${site.name}" > api_token`
        );

        for (const channel of site.notification_channels ?? []) {
          if (channel.webhook_url !== undefined) {
            channel.webhook_url = resolveString(
              channel.webhook_url,
              `organization "${org.name}" > tenant "${tenant.name}" > site "${site.name}" > notification_channel "${channel.name}" > webhook_url`
            );
          }
        }
      }
    }
  }

  return cloned;
}
