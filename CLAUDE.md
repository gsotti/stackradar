# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

StackRadar is a self-hosted observability platform with:
- **Backend**: Express.js + TypeScript + PostgreSQL
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Collectors**: Node.js collectors for Kubernetes and Docker

Features: Log aggregation, uptime monitoring, metric alerts, and notifications.

## Commands

### Backend (`cd backend`)
```bash
npm run dev              # Development with hot reload
npm run build            # Compile TypeScript + copy migrations
npm start                # Run migrations then start app
npm run db:seed          # Seed initial admin user
npm run db:migrate       # Run migrations only
npm run db:reset         # Full reset (down, up, migrate, seed)
```

### Frontend (`cd frontend`)
```bash
npm run dev              # Dev server (proxies API to localhost:8000)
npm run build            # Production build
```

### Docker
```bash
docker-compose up        # Run full stack
docker build -t stackradar . # Build image
```

## Architecture

### Data Hierarchy
```
Tenant → Site → Environment → System → Log Entries
```
- **Tenant**: Multi-tenancy root (users can belong to multiple)
- **Site**: Collection point with API token for ingestion
- **Environment**: dev/staging/prod within a site
- **System**: Application within an environment

### Key Backend Routes
- `/api/auth` - JWT authentication
- `/api/ingest/{apiToken}` - Log ingestion (rate-limited: 1000 req/min)
- `/api/logs` - Log querying with filters
- `/api/sites`, `/api/environments`, `/api/systems` - CRUD operations
- `/api/k8s/metrics/{apiToken}` - Kubernetes metrics ingestion
- `/api/alerts` - Alert rules and notification channels

### Database
PostgreSQL with migrations in `backend/src/db/migrations/`. The migration runner:
- Tracks executed migrations in `migrations` table
- Handles dollar-quoted strings for SQL functions
- Runs automatically on startup via `startup.ts`

Key tables: `users`, `tenants`, `sites`, `environments`, `systems`, `log_entries`, `site_metrics`, `site_metrics_history`, `alert_rules`, `notification_channels`

### Background Jobs (Primary Process Only)
- **Hourly**: Cleanup job removes logs and uptime checks older than `retention_days`
- **Every 5 min**: Alert evaluation checks metrics against thresholds
- **Every minute**: Uptime monitoring checks endpoints

### Auto-Creation
Sites, environments, and systems are auto-created on first log ingestion if they don't exist. The hierarchy service (`backend/src/services/hierarchy.ts`) handles resolution.

## Environment Variables

```
PORT=8000
JWT_SECRET=<required>
ADMIN_API_KEY=<required>
POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME  # For seeding
CLUSTER_MODE=false                        # Enable Node.js clustering
```

## Code Patterns

- Auth middleware adds `req.userId` and `req.userTenantIds` for tenant scoping
- API token validation for ingest endpoints in `middleware/validateApiToken.ts`
- All database queries use parameterized statements via `db.query()`
- TypeScript interfaces for all types in `backend/src/types/index.ts`
- Frontend uses React Context for auth state and app-wide filters
