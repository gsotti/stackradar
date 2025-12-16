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
