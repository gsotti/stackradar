import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import "dotenv/config";

// ---------------------------------------------------------------------------
// Bootstrap: load .env from the script's own directory
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));

// dotenv/config already loads .env from cwd; also try the script directory
// in case the user runs the script from a different directory.
const envPath = resolve(__dirname, ".env");
try {
  const { config } = await import("dotenv");
  config({ path: envPath, override: false });
} catch {
  // ignore — dotenv/config already loaded if it was in cwd
}

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

interface MonitorConfig {
  name: string;
  url: string;
  method?: string;
  interval_seconds?: number;
  timeout_ms?: number;
  expected_status?: number;
  failure_threshold?: number;
  is_main?: boolean;
}

interface ChannelConfig {
  name: string;
  channel_type: string;
  email_recipients?: string[];
  webhook_url?: string;
}

interface SiteConfig {
  name: string;
  description?: string;
  site_type?: string;
  retention_days?: number;
  has_metrics?: boolean;
  tier: "dev" | "qa" | "prod";
  uptime_monitors?: MonitorConfig[];
  notification_channels?: ChannelConfig[];
}

interface TenantConfig {
  name: string;
  description?: string;
  sites?: SiteConfig[];
}

interface ProvisionConfig {
  tenants: TenantConfig[];
}

// ---------------------------------------------------------------------------
// API types (minimal — only what we need)
// ---------------------------------------------------------------------------

interface Tenant {
  id: number;
  name: string;
}

interface Site {
  id: number;
  name: string;
  tenant_id: number;
}

interface Channel {
  id: number;
  name: string;
  site_id: number;
}

interface Monitor {
  id: number;
  name: string;
  site_id: number;
}

interface AlertRule {
  id: number;
  name: string;
  site_id: number;
}

// ---------------------------------------------------------------------------
// Tier-based alert settings
// ---------------------------------------------------------------------------

interface TierAlertSettings {
  failure_threshold: number;
  cooldown_minutes: number;
  repeat_interval_hours: number;
}

const TIER_ALERT_SETTINGS: Record<string, TierAlertSettings> = {
  prod: { failure_threshold: 1, cooldown_minutes: 5, repeat_interval_hours: 1 },
  qa: { failure_threshold: 1, cooldown_minutes: 5, repeat_interval_hours: 1 },
  dev: { failure_threshold: 12, cooldown_minutes: 60, repeat_interval_hours: 1 },
};

// ---------------------------------------------------------------------------
// Console colors
// ---------------------------------------------------------------------------

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function tag(label: string, color: string): string {
  return `${color}${C.bold}[${label}]${C.reset}`;
}

function ok(id: number): string {
  return `${C.green}OK${C.reset} ${C.dim}(id: ${id})${C.reset}`;
}

function skip(id: number): string {
  return `${C.yellow}exists${C.reset} ${C.dim}(id: ${id})${C.reset}`;
}

function err(msg: string): string {
  return `${C.red}ERROR: ${msg}${C.reset}`;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

let baseUrl: string;
let authToken: string;

async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${text}`);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>("GET", path);
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>("POST", path, body);
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>("PUT", path, body);
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

async function authenticate(email: string, password: string): Promise<void> {
  console.log(`\n${tag("Auth", C.cyan)} Logging in as ${C.bold}${email}${C.reset}...`);

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Authentication failed (HTTP ${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  if (!data.access_token) throw new Error("No token in auth response");
  authToken = data.access_token;

  console.log(`${tag("Auth", C.cyan)} ${C.green}Authenticated${C.reset}\n`);
}

// ---------------------------------------------------------------------------
// Tenant provisioning
// ---------------------------------------------------------------------------

async function provisionTenant(cfg: TenantConfig): Promise<number> {
  const existing = await apiGet<Tenant[]>("/api/tenants");
  const found = existing.find(
    (t) => t.name.toLowerCase() === cfg.name.toLowerCase()
  );

  if (found) {
    console.log(
      `${tag("Tenant", C.cyan)} "${cfg.name}" ... ${skip(found.id)}`
    );
    return found.id;
  }

  const created = await apiPost<Tenant>("/api/tenants", {
    name: cfg.name,
    description: cfg.description ?? "",
  });

  console.log(`${tag("Tenant", C.cyan)} Creating "${cfg.name}" ... ${ok(created.id)}`);
  return created.id;
}

// ---------------------------------------------------------------------------
// Site provisioning
// ---------------------------------------------------------------------------

async function provisionSite(
  cfg: SiteConfig,
  tenantId: number
): Promise<number> {
  const existing = await apiGet<Site[]>(`/api/sites?tenant_id=${tenantId}`);
  const found = existing.find(
    (s) => s.name.toLowerCase() === cfg.name.toLowerCase()
  );

  if (found) {
    console.log(
      `  ${tag("Site", C.cyan)} "${cfg.name}" ... ${skip(found.id)}`
    );
    return found.id;
  }

  const created = await apiPost<Site>("/api/sites", {
    name: cfg.name,
    description: cfg.description ?? "",
    tenant_id: tenantId,
    site_type: cfg.site_type ?? "generic",
    retention_days: cfg.retention_days ?? 30,
    has_metrics: cfg.has_metrics ?? false,
  });

  console.log(
    `  ${tag("Site", C.cyan)} Creating "${cfg.name}" ... ${ok(created.id)}`
  );
  return created.id;
}

// ---------------------------------------------------------------------------
// Notification channel provisioning
// ---------------------------------------------------------------------------

async function provisionChannel(
  cfg: ChannelConfig,
  siteId: number
): Promise<number> {
  const existing = await apiGet<Channel[]>(
    `/api/alerts/channels?site_id=${siteId}`
  );
  const found = existing.find(
    (c) => c.name.toLowerCase() === cfg.name.toLowerCase()
  );

  if (found) {
    console.log(
      `    ${tag("Channel", C.cyan)} "${cfg.name}" ... ${skip(found.id)}`
    );
    return found.id;
  }

  const created = await apiPost<Channel>("/api/alerts/channels", {
    site_id: siteId,
    name: cfg.name,
    channel_type: cfg.channel_type,
    email_recipients: cfg.email_recipients ?? [],
    webhook_url: cfg.webhook_url,
  });

  console.log(
    `    ${tag("Channel", C.cyan)} Creating "${cfg.name}" ... ${ok(created.id)}`
  );
  return created.id;
}

// ---------------------------------------------------------------------------
// Uptime monitor provisioning
// ---------------------------------------------------------------------------

async function provisionMonitor(
  cfg: MonitorConfig,
  siteId: number,
  tier: string
): Promise<number> {
  const existing = await apiGet<Monitor[]>(
    `/api/uptime/monitors?site_id=${siteId}`
  );
  const found = existing.find(
    (m) => m.name.toLowerCase() === cfg.name.toLowerCase()
  );

  // Resolve interval — all monitors use 300s; allow per-monitor override
  const interval = cfg.interval_seconds ?? 300;

  const payload = {
    site_id: siteId,
    name: cfg.name,
    url: cfg.url,
    method: cfg.method ?? "GET",
    interval_seconds: interval,
    timeout_ms: cfg.timeout_ms ?? 30000,
    expected_status: cfg.expected_status ?? 200,
    failure_threshold: cfg.failure_threshold ?? 1,
    is_main: cfg.is_main ?? false,
  };

  if (found) {
    await apiPut<Monitor>(`/api/uptime/monitors/${found.id}`, payload);
    console.log(
      `    ${tag("Monitor", C.cyan)} "${cfg.name}" ... ${skip(found.id)}`
    );
    return found.id;
  }

  const created = await apiPost<Monitor>("/api/uptime/monitors", payload);
  console.log(
    `    ${tag("Monitor", C.cyan)} Creating "${cfg.name}" ... ${ok(created.id)}`
  );
  return created.id;
}

// ---------------------------------------------------------------------------
// Alert rule provisioning (auto-generated per monitor)
// ---------------------------------------------------------------------------

async function provisionAlertRule(
  monitorName: string,
  monitorId: number,
  channelId: number,
  siteId: number,
  tier: string
): Promise<void> {
  const ruleName = `${monitorName} Down`;
  const settings = TIER_ALERT_SETTINGS[tier] ?? TIER_ALERT_SETTINGS.prod;

  const existing = await apiGet<AlertRule[]>(
    `/api/alerts/rules?site_id=${siteId}`
  );
  const found = existing.find(
    (r) => r.name.toLowerCase() === ruleName.toLowerCase()
  );

  if (found) {
    console.log(
      `    ${tag("Alert", C.cyan)} "${ruleName}" ... ${skip(found.id)}`
    );
    return;
  }

  const created = await apiPost<AlertRule>("/api/alerts/rules", {
    site_id: siteId,
    name: ruleName,
    alert_type: "uptime",
    monitor_id: monitorId,
    severity: "critical",
    failure_threshold: settings.failure_threshold,
    cooldown_minutes: settings.cooldown_minutes,
    repeat_interval_hours: settings.repeat_interval_hours,
    notification_channel_ids: [channelId],
  });

  console.log(
    `    ${tag("Alert", C.cyan)} Creating "${ruleName}" ... ${ok(created.id)}`
  );
}

// ---------------------------------------------------------------------------
// Main provisioning loop
// ---------------------------------------------------------------------------

async function provision(config: ProvisionConfig): Promise<void> {
  for (const tenantCfg of config.tenants) {
    console.log(`\n${"─".repeat(60)}`);
    const tenantId = await provisionTenant(tenantCfg);

    for (const siteCfg of tenantCfg.sites ?? []) {
      console.log();
      const siteId = await provisionSite(siteCfg, tenantId);
      const tier = siteCfg.tier ?? "prod";

      // --- Notification channels -------------------------------------------
      const channelIdMap = new Map<string, number>();
      for (const channelCfg of siteCfg.notification_channels ?? []) {
        const channelId = await provisionChannel(channelCfg, siteId);
        channelIdMap.set(channelCfg.name, channelId);
      }

      // --- Uptime monitors + auto-generated alert rules --------------------
      const monitors = siteCfg.uptime_monitors ?? [];
      const monitoringEmailId = channelIdMap.get("monitoring-email");

      for (const monitorCfg of monitors) {
        const monitorId = await provisionMonitor(monitorCfg, siteId, tier);

        // Auto-generate one alert rule per monitor if channel is available
        if (monitoringEmailId !== undefined) {
          await provisionAlertRule(
            monitorCfg.name,
            monitorId,
            monitoringEmailId,
            siteId,
            tier
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(
    `\n${C.bold}${C.cyan}StackRadar Provisioning Script${C.reset}`
  );
  console.log(`${"═".repeat(60)}`);

  // Validate env vars
  const requiredEnv = ["STACKRADAR_URL", "STACKRADAR_EMAIL", "STACKRADAR_PASSWORD"];
  const missing = requiredEnv.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      err(
        `Missing environment variables: ${missing.join(", ")}\n` +
          `Copy .env.example to .env and fill in the values.`
      )
    );
    process.exit(1);
  }

  baseUrl = process.env.STACKRADAR_URL!.replace(/\/$/, "");
  const email = process.env.STACKRADAR_EMAIL!;
  const password = process.env.STACKRADAR_PASSWORD!;

  // Load config
  const configPath = resolve(__dirname, "stackradar.config.yml");
  let configRaw: string;
  try {
    configRaw = readFileSync(configPath, "utf-8");
  } catch {
    console.error(err(`Cannot read config file: ${configPath}`));
    process.exit(1);
  }

  let config: ProvisionConfig;
  try {
    config = parseYaml(configRaw) as ProvisionConfig;
  } catch (e) {
    console.error(err(`Failed to parse YAML config: ${(e as Error).message}`));
    process.exit(1);
  }

  if (!config.tenants || !Array.isArray(config.tenants)) {
    console.error(err("Config must have a top-level 'tenants' array"));
    process.exit(1);
  }

  // Authenticate
  try {
    await authenticate(email, password);
  } catch (e) {
    console.error(err((e as Error).message));
    process.exit(1);
  }

  // Provision
  try {
    await provision(config);
  } catch (e) {
    console.error(`\n${err((e as Error).message)}`);
    process.exit(1);
  }

  console.log(
    `\n${"═".repeat(60)}\n${C.green}${C.bold}Provisioning complete.${C.reset}\n`
  );
}

main();
