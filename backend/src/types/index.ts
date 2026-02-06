import { Request } from 'express';

// Role Types
export type GlobalRole = 'superadmin' | 'org_admin' | null;
export type TenantRole = 'tenant_admin' | 'editor' | 'viewer';

// Database Models
export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  is_active: boolean;
  is_approved: boolean;
  is_admin: boolean;
  is_viewer: boolean;
  global_role: string | null;
  email_verified: boolean;
  created_by: number | null;
  organization_id: number | null;
  created_at: Date;
}

export interface UserWithRoles extends Omit<User, 'password_hash'> {
  global_role: GlobalRole;
  email_verified: boolean;
  tenant_role?: TenantRole;
  tenant_ids: number[];
}

export interface Site {
  id: number;
  name: string;
  description: string | null;
  api_token: string;
  retention_days: number;
  site_type: 'docker' | 'kubernetes' | 'generic';
  tenant_id: number;
  created_at: Date;
}

export interface Tenant {
  id: number;
  name: string;
  description: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Organization {
  id: number;
  name: string;
  description: string | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Invitation {
  id: number;
  email: string;
  token: string;
  tenant_id: number;
  role: TenantRole;
  invited_by: number;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

export interface Environment {
  id: number;
  site_id: number;
  name: string;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface System {
  id: number;
  environment_id: number;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface LogEntry {
  id: number;
  system_id: number;
  timestamp: Date;
  level: string;
  message: string;
  source: string | null;
  metadata: Record<string, any> | null;
  tenant: string | null;
  site: string | null;
  environment: string | null;
  system: string | null;
  tenant_id: number | null;
  created_at: Date;
}

export interface K8sMetrics {
  id: number;
  site_id: number;
  node_count: number;
  node_ready: number;
  pod_count: number;
  pod_running: number;
  pod_pending: number;
  pod_failed: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  deployment_count: number;
  deployment_ready: number;
  service_count: number;
  pvc_count: number;
  pvc_bound: number;
  pv_count: number;
  tenant_id: number | null;
  updated_at: Date;
}

// API Request/Response Types
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email?: string;
  username?: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface CreateSiteRequest {
  name: string;
  description?: string;
  retention_days?: number;
  site_type?: 'docker' | 'kubernetes' | 'generic';
}

export interface UpdateSiteRequest {
  name?: string;
  description?: string;
  retention_days?: number;
  site_type?: 'docker' | 'kubernetes' | 'generic';
}

export interface CreateEnvironmentRequest {
  site_id: number;
  name: string;
}

export interface UpdateEnvironmentRequest {
  name?: string;
  display_name?: string;
}

export interface CreateSystemRequest {
  environment_id: number;
  name: string;
  description?: string;
}

export interface UpdateSystemRequest {
  name?: string;
  description?: string;
}

export interface IngestLogRequest {
  level?: string;
  message: string;
  source?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
  tenant?: string;
  site?: string;
  environment?: string;
  system?: string;
}

export interface IngestLogsRequest {
  logs: IngestLogRequest[];
}

// Extended Express Request with auth
export interface AuthRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<P, ResBody, ReqBody, ReqQuery> {
  userId?: number;
  userTenantIds?: number[]; // enforced tenant visibility for the authenticated user
  globalRole?: GlobalRole;
  tenantRole?: TenantRole;
  organizationId?: number;
  emailVerified?: boolean;
}

// JWT Payload
export interface JWTPayload {
  sub: number;
  iat?: number;
  exp?: number;
}

// Migration
export interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

// Alerting System Types
export type MetricType =
  | 'cpu_percent'
  | 'memory_percent'
  | 'error_logs'
  | 'pod_failed'
  | 'pod_pending'
  | 'deployment_readiness'
  | 'pvc_bound'
  | 'node_health';

export type AlertType = 'metric' | 'uptime';

export type ThresholdOperator = '>' | '>=' | '<' | '<=' | '=';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertState = 'firing' | 'resolved';
export type ChannelType = 'email' | 'webhook';

export interface AlertRule {
  id: number;
  site_id: number;
  name: string;
  description: string | null;
  alert_type: AlertType;
  metric_type: MetricType | null;
  threshold_operator: ThresholdOperator | null;
  threshold_value: number | null;
  time_window_minutes: number;
  cooldown_minutes: number;
  failure_threshold: number;
  repeat_interval_hours: number;
  severity: AlertSeverity;
  enabled: boolean;
  monitor_id: number | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationChannel {
  id: number;
  site_id: number;
  name: string;
  channel_type: ChannelType;
  enabled: boolean;
  email_recipients: string[] | null;
  webhook_url: string | null;
  webhook_headers: Record<string, string> | null;
  created_at: Date;
  updated_at: Date;
}

export interface AlertRuleChannel {
  alert_rule_id: number;
  notification_channel_id: number;
}

export interface AlertHistory {
  id: number;
  alert_rule_id: number | null;
  site_id: number;
  state: AlertState;
  triggered_at: Date;
  resolved_at: Date | null;
  metric_value: number | null;
  threshold_value: number | null;
  message: string | null;
  notification_sent: boolean;
  notification_error: string | null;
}

export interface SmtpConfig {
  id: number;
  host: string;
  port: number;
  secure: boolean;
  auth_user: string | null;
  auth_password: string | null;
  from_email: string;
  from_name: string;
  created_at: Date;
  updated_at: Date;
}

// Alert API Request Types
export interface CreateAlertRuleRequest {
  site_id: number;
  name: string;
  description?: string;
  alert_type?: AlertType;
  metric_type?: MetricType;
  threshold_operator?: ThresholdOperator;
  threshold_value?: number;
  time_window_minutes?: number;
  cooldown_minutes?: number;
  failure_threshold?: number;
  repeat_interval_hours?: number;
  severity?: AlertSeverity;
  notification_channel_ids?: number[];
  monitor_id?: number;
}

export interface UpdateAlertRuleRequest {
  name?: string;
  description?: string;
  alert_type?: AlertType;
  metric_type?: MetricType;
  threshold_operator?: ThresholdOperator;
  threshold_value?: number;
  time_window_minutes?: number;
  cooldown_minutes?: number;
  failure_threshold?: number;
  repeat_interval_hours?: number;
  severity?: AlertSeverity;
  enabled?: boolean;
  notification_channel_ids?: number[];
  monitor_id?: number;
}

export interface CreateNotificationChannelRequest {
  site_id: number;
  name: string;
  channel_type: ChannelType;
  email_recipients?: string[];
  webhook_url?: string;
  webhook_headers?: Record<string, string>;
}

export interface UpdateNotificationChannelRequest {
  name?: string;
  enabled?: boolean;
  email_recipients?: string[];
  webhook_url?: string;
  webhook_headers?: Record<string, string>;
}

export interface CreateSmtpConfigRequest {
  host: string;
  port: number;
  secure?: boolean;
  auth_user?: string;
  auth_password?: string;
  from_email: string;
  from_name?: string;
}

export interface UpdateSmtpConfigRequest {
  host?: string;
  port?: number;
  secure?: boolean;
  auth_user?: string;
  auth_password?: string;
  from_email?: string;
  from_name?: string;
}

// Uptime Monitoring Types
export type UptimeStatus = 'up' | 'down' | 'degraded' | 'unknown';
export type HttpMethod = 'GET' | 'HEAD' | 'POST';

export interface UptimeMonitor {
  id: number;
  site_id: number;
  name: string;
  url: string;
  method: HttpMethod;
  interval_seconds: number;
  timeout_ms: number;
  expected_status: number;
  failure_threshold: number;
  is_main: boolean;
  enabled: boolean;
  current_status: UptimeStatus;
  consecutive_failures: number;
  last_status_change: Date | null;
  last_checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UptimeCheck {
  id: number;
  monitor_id: number;
  status: UptimeStatus;
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  checked_at: Date;
}

export interface CreateUptimeMonitorRequest {
  site_id: number;
  name: string;
  url: string;
  method?: HttpMethod;
  interval_seconds?: number;
  timeout_ms?: number;
  expected_status?: number;
  failure_threshold?: number;
  is_main?: boolean;
}

export interface UpdateUptimeMonitorRequest {
  name?: string;
  url?: string;
  method?: HttpMethod;
  interval_seconds?: number;
  timeout_ms?: number;
  expected_status?: number;
  failure_threshold?: number;
  is_main?: boolean;
  enabled?: boolean;
}
