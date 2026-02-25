# StackRadar 🚀

A self-hosted full-stack observability platform - log aggregation, uptime monitoring, and alerting.

## Features

- 📝 **Log Aggregation**: Collect logs from multiple systems via REST API
- ⏱️ **Uptime Monitoring**: HTTP endpoint monitoring with configurable intervals
- 🔔 **Alerting**: Metric-based and uptime alerts with email/webhook notifications
- 👥 **Multi-Tenant**: Multi-tenancy with user management
- 🖥️ **Multi-Site**: Manage multiple sites with environments and systems
- 🔍 **Search & Filter**: Full-text search with level and source filters
- 📊 **Dashboard**: Real-time statistics and visualizations
- ☸️ **Kubernetes Monitoring**: Cluster metrics and resource tracking
- 🧹 **Auto-Cleanup**: Configurable retention per site
- 🐳 **Docker Ready**: Single container deployment
- ⎈ **Helm Chart**: Easy Kubernetes deployment

## Quick Start

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/gsotti/stackradar.git
cd stackradar

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:8000
```

### Using Docker

```bash
# Build the image
docker build -t stackradar .

# Run the container
docker run -d \
  -p 8000:8000 \
  -v stackradar-data:/app/data \
  -e JWT_SECRET=your-secret-key \
  -e ADMIN_API_KEY=your-admin-key \
  stackradar
```

### Using Helm (Kubernetes)

```bash
# Install from local chart
cd helm
helm install stackradar ./stackradar \
  --set secrets.jwtSecret=your-secret-key \
  --set secrets.adminApiKey=your-admin-key \
  --set domain=stackradar.example.com
```

## API Usage

### Authentication

```bash
# Register a new user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret", "name": "User"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret"}'
```

### Log Ingestion

```bash
# Send multiple logs
curl -X POST "http://localhost:8000/api/ingest/YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {"level": "INFO", "message": "Application started", "source": "main"},
      {"level": "ERROR", "message": "Connection failed", "source": "db"}
    ]
  }'
```

### Kubernetes Metrics

```bash
# Send K8s metrics
curl -X POST "http://localhost:8000/api/k8s/metrics/YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "node_count": 3,
    "node_ready": 3,
    "pod_count": 50,
    "pod_running": 48,
    "cpu_usage_percent": 45.5,
    "memory_usage_percent": 62.3
  }'
```

## Declarative Configuration (YAML)

StackRadar supports a declarative YAML config file that defines your entire organizational structure — organizations, users, tenants, sites, environments, alerts, and more. The database syncs to match the config on every startup.

### Setup

```bash
# Copy the example config
cp backend/stackradar.config.example.yml backend/stackradar.config.yml

# Edit it to match your setup, then start normally
npm start
```

Or set a custom path:

```bash
STACKRADAR_CONFIG=/path/to/config.yml npm start
```

If no config file is found, StackRadar falls back to the `ADMIN_EMAIL`/`ADMIN_PASSWORD` env var seeding.

### Example Config

```yaml
organizations:
  - name: "Acme Corp"
    smtp:
      host: smtp.example.com
      port: 587
      auth_user: alerts@example.com
      auth_password: ${SMTP_PASSWORD}
      from_email: alerts@example.com
    users:
      - email: admin@acme.com
        name: Admin User
        password: ${ADMIN_PASSWORD}
        global_role: org_admin
        tenants:
          - tenant: Production
            role: tenant_admin
    tenants:
      - name: Production
        sites:
          - name: web-cluster
            api_token: ${WEB_CLUSTER_TOKEN}
            site_type: kubernetes
            retention_days: 90
            has_metrics: true
            environments:
              - name: prod
                systems:
                  - name: api-gateway
            uptime_monitors:
              - name: Main Website
                url: https://example.com
                interval_seconds: 60
            notification_channels:
              - name: ops-email
                channel_type: email
                email_recipients: ["ops@acme.com"]
            alert_rules:
              - name: high-cpu
                alert_type: metric
                metric_type: cpu_percent
                threshold_operator: ">"
                threshold_value: 90
                severity: critical
                notification_channels: [ops-email]
```

### Environment Variable Substitution

Use `${VAR_NAME}` in password, api_token, auth_password, and webhook_url fields. The server aborts on startup if any referenced variable is unset.

### Docker

Mount the config file into the container:

```bash
docker run -d \
  -v ./stackradar.config.yml:/app/stackradar.config.yml:ro \
  -e ADMIN_PASSWORD=secret \
  -e WEB_CLUSTER_TOKEN=tok-123 \
  stackradar
```

### Kubernetes

Use a ConfigMap for the YAML structure and a Secret for sensitive env vars:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: stackradar-config
data:
  stackradar.config.yml: |
    organizations:
      - name: Acme Corp
        users:
          - email: admin@acme.com
            name: Admin
            password: ${ADMIN_PASSWORD}
            global_role: org_admin
            tenants:
              - tenant: Production
                role: tenant_admin
        tenants:
          - name: Production
            sites:
              - name: web-cluster
                api_token: ${WEB_CLUSTER_TOKEN}
                site_type: kubernetes
---
apiVersion: v1
kind: Secret
metadata:
  name: stackradar-secrets
stringData:
  ADMIN_PASSWORD: "supersecret"
  WEB_CLUSTER_TOKEN: "tok-abc123"
```

Then mount in the Deployment:

```yaml
containers:
  - name: stackradar
    envFrom:
      - secretRef:
          name: stackradar-secrets
    volumeMounts:
      - name: config
        mountPath: /app/stackradar.config.yml
        subPath: stackradar.config.yml
        readOnly: true
volumes:
  - name: config
    configMap:
      name: stackradar-config
```

### Sync Behavior

| Entity | On removal from config |
|---|---|
| Organization | Users unlinked, user_tenants removed (row preserved) |
| User | Set `is_active=false`, user_tenants removed. Superadmins are never touched |
| Tenant | user_tenants links removed (row + data preserved) |
| Site / Environment / System | Row preserved (no cascade deletion of logs/metrics) |
| Uptime monitor / Notification channel / Alert rule | Hard deleted (operational config, not data) |
| SMTP config | Hard deleted if absent |

Re-adding a previously removed tenant or site reuses the existing DB row — all historical data becomes visible again.

## Data Hierarchy

```
Tenant → Site → Environment → System → Log Entries
                    ↓
              Uptime Monitors
                    ↓
              Alert Rules → Notification Channels
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8000 |
| `POSTGRES_HOST` | PostgreSQL host | postgres |
| `POSTGRES_PORT` | PostgreSQL port | 5432 |
| `POSTGRES_USER` | PostgreSQL user | stackradar |
| `POSTGRES_PASSWORD` | PostgreSQL password | (required) |
| `POSTGRES_DB` | PostgreSQL database | stackradar |
| `JWT_SECRET` | Secret key for JWT tokens | (required) |
| `ADMIN_API_KEY` | Admin key for admin operations | (required) |
| `CLUSTER_MODE` | Enable Node.js multi-core clustering | true |
| `WORKERS` | Number of worker processes | <cpu count> |
| `STACKRADAR_CONFIG` | Path to declarative YAML config file | `backend/stackradar.config.yml` |

## Development

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      StackRadar                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   React     │  │   Express   │  │ PostgreSQL  │     │
│  │  Frontend   │◄─┤   Backend   │◄─┤  Database   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              REST API Endpoints                  │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  /api/auth/*      - Authentication              │   │
│  │  /api/sites/*     - Site management             │   │
│  │  /api/ingest/*    - Log ingestion (by token)    │   │
│  │  /api/logs/*      - Log queries                 │   │
│  │  /api/k8s/*       - Kubernetes metrics          │   │
│  │  /api/uptime/*    - Uptime monitoring           │   │
│  │  /api/alerts/*    - Alert rules & channels      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
           ▲                           ▲
           │                           │
    ┌──────┴──────┐             ┌──────┴──────┐
    │  Your Apps  │             │  K8s/Docker │
    │  (send logs)│             │  Collectors │
    └─────────────┘             └─────────────┘
```

## Background Jobs

- **Every minute**: Uptime monitoring checks
- **Every 5 minutes**: Alert evaluation
- **Every hour**: Cleanup old logs and uptime checks

## License

MIT License
