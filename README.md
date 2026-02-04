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
