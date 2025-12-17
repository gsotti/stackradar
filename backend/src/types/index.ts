import { Request } from 'express';

// Database Models
export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  is_active: boolean;
  is_approved: boolean;
  is_admin: boolean;
  created_at: Date;
}

export interface System {
  id: number;
  name: string;
  description: string | null;
  api_token: string;
  retention_days: number;
  tenant_id: number;
  created_at: Date;
}

export interface Tenant {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Application {
  id: number;
  system_id: number;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Environment {
  id: number;
  application_id: number;
  name: string;
  created_at: Date;
  deleted_at: Date | null;
}

export interface LogEntry {
  id: number;
  environment_id: number | null;
  timestamp: Date;
  level: string;
  message: string;
  source: string | null;
  metadata: Record<string, any> | null;
  tenant: string | null;
  system_type: string | null;
  environment: string | null;
  application: string | null;
  tenant_id: number | null;
  application_id: number | null;
  created_at: Date;
}

export interface K8sMetrics {
  id: number;
  system_id: number;
  cluster_name: string | null;
  node_count: number;
  node_ready: number;
  pod_count: number;
  pod_running: number;
  pod_pending: number;
  pod_failed: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  cpu_requests: number;
  cpu_limits: number;
  memory_requests: number;
  memory_limits: number;
  deployment_count: number;
  deployment_ready: number;
  service_count: number;
  pvc_count: number;
  pvc_bound: number;
  namespaces: string | null;
  alerts: string | null;
  tenant: string | null;
  system_type: string | null;
  environment: string | null;
  application: string | null;
  tenant_id: number | null;
  application_id: number | null;
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

export interface CreateSystemRequest {
  name: string;
  description?: string;
  retention_days?: number;
}

export interface IngestLogRequest {
  level?: string;
  message: string;
  source?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
  tenant?: string;
  system_type?: string;
  environment?: string;
  application?: string;
}

export interface IngestLogsRequest {
  logs: IngestLogRequest[];
}

// Extended Express Request with auth
export interface AuthRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<P, ResBody, ReqBody, ReqQuery> {
  userId?: number;
  userTenantIds?: number[]; // enforced tenant visibility for the authenticated user
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

export type ThresholdOperator = '>' | '>=' | '<' | '<=' | '=';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertState = 'firing' | 'resolved';
export type ChannelType = 'email' | 'webhook';

export interface AlertRule {
  id: number;
  system_id: number;
  name: string;
  description: string | null;
  metric_type: MetricType;
  threshold_operator: ThresholdOperator;
  threshold_value: number;
  time_window_minutes: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldown_minutes: number;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
}

export interface NotificationChannel {
  id: number;
  system_id: number;
  name: string;
  channel_type: ChannelType;
  enabled: boolean;
  email_recipients: string[] | null;
  webhook_url: string | null;
  webhook_method: string | null;
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
  alert_rule_id: number;
  system_id: number;
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
  system_id: number;
  name: string;
  description?: string;
  metric_type: MetricType;
  threshold_operator: ThresholdOperator;
  threshold_value: number;
  time_window_minutes?: number;
  severity?: AlertSeverity;
  cooldown_minutes?: number;
  notification_channel_ids?: number[];
}

export interface UpdateAlertRuleRequest {
  name?: string;
  description?: string;
  metric_type?: MetricType;
  threshold_operator?: ThresholdOperator;
  threshold_value?: number;
  time_window_minutes?: number;
  severity?: AlertSeverity;
  enabled?: boolean;
  cooldown_minutes?: number;
  notification_channel_ids?: number[];
}

export interface CreateNotificationChannelRequest {
  system_id: number;
  name: string;
  channel_type: ChannelType;
  email_recipients?: string[];
  webhook_url?: string;
  webhook_method?: string;
  webhook_headers?: Record<string, string>;
}

export interface UpdateNotificationChannelRequest {
  name?: string;
  enabled?: boolean;
  email_recipients?: string[];
  webhook_url?: string;
  webhook_method?: string;
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
