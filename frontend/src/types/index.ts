// Database Models
export interface TenantRole {
  tenant_id: number;
  tenant_name: string;
  role: string;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  is_active: boolean;
  is_approved: boolean;
  global_role: string | null;
  email_verified: boolean;
  organization_id: number | null;
  organization_name?: string;
  tenant_roles: TenantRole[];
  created_at: string;
}

export interface Site {
  id: number;
  name: string;
  description: string | null;
  api_token: string;
  retention_days: number;
  site_type: 'docker' | 'kubernetes' | 'generic';
  has_metrics: boolean;
  tenant_id: number;
  created_at: string;
}

export interface Tenant {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: number;
  name: string;
  description: string | null;
  created_by?: number;
  created_at: string;
  updated_at: string;
  user_count?: number;
  tenant_count?: number;
}

export interface Environment {
  id: number;
  site_id: number;
  name: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface System {
  id: number;
  environment_id: number;
  name: string;
  description: string | null;
  environment_name?: string;
  site_name?: string;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: number;
  system_id: number;
  timestamp: string;
  level: string;
  message: string;
  source: string | null;
  metadata: Record<string, any> | null;
  tenant: string | null;
  site: string | null;
  environment: string | null;
  system: string | null;
  tenant_id: number | null;
  created_at: string;
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
  updated_at: string;
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
  user?: User;
}

export interface CreateSiteRequest {
  name: string;
  description?: string;
  retention_days?: number;
  site_type?: 'docker' | 'kubernetes' | 'generic';
  has_metrics?: boolean;
}

export interface UpdateSiteRequest {
  name?: string;
  description?: string;
  retention_days?: number;
  site_type?: 'docker' | 'kubernetes' | 'generic';
  has_metrics?: boolean;
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
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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
  triggered_at: string;
  resolved_at: string | null;
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
  created_at: string;
  updated_at: string;
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
  last_status_change: string | null;
  last_checked_at: string | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
  last_response_time?: number; // Added for frontend cards
  site_name?: string; // Added for frontend cards
}

export interface UptimeCheck {
  id: number;
  monitor_id: number;
  status: UptimeStatus;
  response_time_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  checked_at: string;
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

// Frontend Context Types
export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  loading: boolean;
  isSuperadmin: () => boolean;
  isOrgAdmin: () => boolean;
  getTenantRole: (tenantId: number | string) => string | null;
  canManageTenant: (tenantId: number | string) => boolean;
}

export interface AppContextType {
  selectedSiteId: string;
  setSelectedSiteId: (id: string) => void;
  selectedSystemId: string;
  setSelectedSystemId: (id: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  selectedTenant: string;
  setSelectedTenant: (id: string) => void;
  selectedSite: string;
  setSelectedSite: (id: string) => void;
  selectedEnvironment: string;
  setSelectedEnvironment: (id: string) => void;
  selectedSystem: string;
  setSelectedSystem: (id: string) => void;
  language: string;
  setLanguage: (lang: string) => void;
}

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

export interface NotificationContextType {
  notifications: Notification[];
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  removeNotification: (id: number) => void;
}

// User Management Types
export type TenantRoleName = 'tenant_admin' | 'editor' | 'viewer';

export interface TenantUser {
  id: number;
  email: string;
  name: string | null;
  role: TenantRoleName;
  created_at: string;
}

export interface Invitation {
  id: number;
  tenant_id: number;
  email: string;
  role: TenantRoleName;
  token: string;
  expires_at: string;
  invited_by: number;
  invited_by_name: string | null;
  created_at: string;
}

export interface CreateInvitationRequest {
  tenant_id: number;
  email: string;
  role: TenantRoleName;
}

export interface AcceptInvitationRequest {
  name: string;
  password: string;
}
