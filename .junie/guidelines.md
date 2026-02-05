# StackRadar Project Guidelines

## Project Overview
StackRadar is a self-hosted full-stack observability platform designed for log aggregation, uptime monitoring, and alerting. It provides a centralized dashboard to manage multiple sites, environments, and systems.

### Core Features
- **Log Aggregation**: REST API for collecting logs from various sources.
- **Uptime Monitoring**: Periodic HTTP endpoint checks.
- **Alerting**: Metric-based and uptime alerts with notification support (Email/Webhook).
- **Multi-Tenancy**: Built-in user and tenant management.
- **Kubernetes Integration**: Cluster metrics tracking and dedicated collectors.
- **Data Hierarchy**: Tenant → Site → Environment → System → Logs/Metrics.

## Project Structure
- `backend/`: Express.js server, PostgreSQL database management, and background jobs.
  - `src/db/`: Database initialization, migrations (SQL-based), and seeding.
  - `src/routes/`: API endpoint definitions.
  - `src/services/`: Business logic for alerting, uptime checks, and log cleanup.
- `frontend/`: React application built with Vite and Tailwind CSS.
- `collector-docker/` & `collector-k8s/`: Scripts and configurations for collecting logs and metrics from different environments.
- `helm/`: Kubernetes deployment configurations.
- `Dockerfile`: Multi-stage build for production.
- `docker-compose.yml`: Local development and production orchestration.

## Development Guidelines

### Technology Stack
- **Backend**: Node.js, Express, TypeScript, PostgreSQL.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS.
- **Infrastructure**: Docker, Helm.

### Common Tasks
- **Database Migrations**: New database changes should be added as sequentially numbered SQL files in `backend/src/db/migrations/`.
- **Building & Deploying**: Use `./build-deploy.sh <version>` to build and push Docker images.

## Instructions for Junie

### Code Style
- Follow the existing TypeScript patterns in both backend and frontend.
- Maintain consistency with the existing directory structure and naming conventions.
- When modifying the backend, ensure that `CLUSTER_MODE` and background job scheduling are considered in `backend/src/index.ts`.

### Execution, Testing & Building
- **Strict Restriction**: Do NOT run tests, build the project, or execute any changes.
- This project has its own deployment and verification workflow outside of this environment.
- For backend changes, ensure that any new database requirements are reflected in migrations.
