# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

StackRadar is a self-hosted observability platform with:
- **Backend**: Express.js + TypeScript + PostgreSQL
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Collectors**: Node.js collectors for Kubernetes, Docker, and AWS Lambda

Features: Log aggregation, uptime monitoring, metric alerts, notifications, audit logging, and multi-organization support.

**Package manager**: Yarn 4.12.0 (both backend and frontend).

## Commands

### Backend (`cd backend`)
```bash
yarn dev              # Development with hot reload (tsx watch)
yarn build            # Compile TypeScript + copy migrations + obfuscate
yarn build:no-obfuscate  # Build without code obfuscation
yarn start            # Run migrations then start app
yarn db:seed          # Seed initial admin user
yarn db:migrate       # Run migrations only
yarn db:reset         # Full reset (down, up, migrate, seed)
```

### Frontend (`cd frontend`)
```bash
yarn dev              # Dev server (proxies API to localhost:8000)
yarn build            # Production build
yarn preview          # Preview production build
```

### Docker
```bash
docker-compose up              # Development stack (unified image, external DB)
docker-compose -f docker-compose.prod.yml up  # Production stack (includes PostgreSQL)
docker build -t stackradar .   # Build unified image
```

## Architecture

### Data Hierarchy
```
Organization → Tenant → Site → Environment → System → Log Entries
```
- **Organization**: Top-level grouping; owns SMTP config and org-level admins
- **Tenant**: Multi-tenancy unit within an org; users can belong to multiple tenants
- **Site**: Collection point with API token for ingestion; types: `docker`, `kubernetes`, `generic`, `aws_lambda`
- **Environment**: dev/staging/prod within a site
- **System**: Application within an environment

### Role Hierarchy
- `superadmin` (global) → can manage all organizations, users, settings
- `org_admin` (organization-scoped) → manages tenants and users within their org
- `tenant_admin` / `viewer` (tenant-scoped) → per-tenant roles

`AuthContext` exposes: `isSuperadmin()`, `isOrgAdmin()`, `getTenantRole()`, `canManageTenant()`

### Key Backend Routes
- `/api/auth` - JWT authentication
- `/api/ingest/{apiToken}` - Log ingestion (rate-limited: 1000 req/min)
- `/api/logs` - Log querying with filters
- `/api/sites`, `/api/environments`, `/api/systems` - CRUD operations
- `/api/k8s/metrics/{apiToken}` - Kubernetes metrics ingestion
- `/api/lambda` - AWS Lambda metrics ingestion
- `/api/alerts` - Alert rules and notification channels
- `/api/uptime` - Uptime monitors and check history
- `/api/organizations` - Organization management
- `/api/tenants`, `/api/tenant-users` - Tenant and membership management
- `/api/invitations` - User invitation flow
- `/api/audit-logs` - Audit trail
- `/api/admin` - Admin endpoints
- `/api/superadmin` - Superadmin-only endpoints
- `/api/settings` - System settings (app URL, etc.)

### Database
PostgreSQL with 29 migrations in `backend/src/db/migrations/`. The migration runner:
- Tracks executed migrations in `migrations` table
- Handles dollar-quoted strings for SQL functions
- Runs automatically on startup via `startup.ts`

Key tables:
```
users, organizations, tenants, tenant_user_roles, user_roles
sites, environments, systems, log_entries
site_metrics, site_metrics_history          # Kubernetes metrics
lambda_metrics, lambda_metrics_history      # AWS Lambda metrics
uptime_monitors, uptime_checks
alert_rules, notification_channels
audit_logs
system_settings                             # DB-driven config: app_url, per-org SMTP
login_attempts
```

### Background Jobs (Primary Process Only)
- **Hourly**: Cleanup job removes logs and uptime checks older than `retention_days`
- **Every 5 min**: Alert evaluation checks metrics against thresholds
- **Every minute**: Uptime monitoring checks endpoints (worker pool, configurable concurrency)

### Auto-Creation
Sites, environments, and systems are auto-created on first log ingestion if they don't exist. The hierarchy service (`backend/src/services/hierarchy.ts`) handles resolution.

### Build Notes
- Production builds run `obfuscate.mjs` (javascript-obfuscator) on the compiled output
- Use `yarn build:no-obfuscate` for readable output during development/debugging
- Docker: `docker-compose.yml` is a single unified container (backend+frontend); `docker-compose.prod.yml` uses separate backend, frontend, and PostgreSQL services

## Environment Variables

```
PORT=8000
JWT_SECRET=<required>
ADMIN_API_KEY=<required>
POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME  # For seeding
CLUSTER_MODE=true                         # Enable Node.js clustering (default: true)
WORKERS=<n>                               # Worker count (default: CPU count)
ALLOWED_ORIGINS=http://localhost:5173     # CORS origins (DB app_url takes precedence)
STACKRADAR_CONFIG=<path>                  # YAML provisioning config file
UPTIME_TICK_MS=15000                      # Uptime check interval
UPTIME_STALE_TIMEOUT_MS=300000            # Uptime stale result timeout
UPTIME_CONCURRENCY=25                     # Max concurrent uptime checks
```

## Code Patterns

- Auth middleware adds `req.userId` and `req.userTenantIds` for tenant scoping
- Role middleware (`middleware/roleMiddleware.ts`) enforces org/superadmin access
- API token validation for ingest endpoints in `middleware/validateApiToken.ts`
- All database queries use parameterized statements via `db.query()`
- TypeScript interfaces for all types in `backend/src/types/index.ts`
- Frontend uses React Context for auth state (`AuthContext`), app-wide filters (`AppContext`), and toasts (`NotificationContext`)
- SMTP config is org-scoped: `alerting/smtp.ts` → `getSmtpConfig(organizationId)`
- Audit events written via `services/auditLogger.ts`

## Collectors

| Collector | Location | What it does |
|-----------|----------|--------------|
| Kubernetes logs | `collector-k8s/log-collector/` | Forwards pod logs to `/api/ingest` |
| Kubernetes stats | `collector-k8s/stats-collector/` | CPU, memory, pod/node counts → `/api/k8s/metrics` |
| Docker logs | `collector-docker/logs/` | Forwards container logs |
| Docker stats | `collector-docker/stats/` | Container resource metrics |
| AWS Lambda | `collector-lambda/` | CloudWatch → StackRadar via CloudFormation template |

Helm charts for Kubernetes deployment in `helm/` (main app + log/stats collectors).
