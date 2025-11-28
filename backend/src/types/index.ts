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
  user_id: number;
  created_at: Date;
}

export interface LogEntry {
  id: number;
  system_id: number;
  timestamp: Date;
  level: string;
  message: string;
  source: string | null;
  metadata: Record<string, any> | null;
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
}

export interface IngestLogsRequest {
  logs: IngestLogRequest[];
}

// Extended Express Request with auth
export interface AuthRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<P, ResBody, ReqBody, ReqQuery> {
  userId?: number;
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
