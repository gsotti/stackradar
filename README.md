# LogRadar 🚀

A simple, self-hosted log aggregation service - as an alternative to Papertrail.

## Features

- 📝 **Log Aggregation**: Collect logs from multiple systems via REST API
- 👥 **Multi-User**: User authentication with JWT tokens
- 🖥️ **Multi-System**: Manage multiple systems/clients per user
- 🔍 **Search & Filter**: Full-text search with level and source filters
- 📊 **Dashboard**: Real-time statistics and visualizations
- ☸️ **Kubernetes Monitoring**: Optional cluster metrics dashboard
- 🧹 **Auto-Cleanup**: Configurable retention per system (via cron)
- 🐳 **Docker Ready**: Single container deployment
- ⎈ **Helm Chart**: Easy Kubernetes deployment

## Quick Start

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/your-org/logpilot.git
cd logpilot

# Start with Docker Compose
docker-compose up -d

# Access at http://localhost:8000
```

### Using Docker

```bash
# Build the image
docker build -t logpilot .

# Run the container
docker run -d \
  -p 8000:8000 \
  -v logpilot-data:/app/data \
  -e JWT_SECRET=your-secret-key \
  -e ADMIN_API_KEY=your-admin-key \
  logpilot
```

### Using Helm (Kubernetes)

```bash
# Add the repo (if published)
helm repo add logpilot https://your-org.github.io/logpilot

# Or install from local chart
cd helm
helm install logpilot ./logpilot \
  --set config.jwtSecret=your-secret-key \
  --set config.adminApiKey=your-admin-key \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=logpilot.example.com
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
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user@example.com&password=secret"
```

### System Management

```bash
# Create a system (requires Bearer token)
curl -X POST http://localhost:8000/api/systems \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "description": "My Application", "retention_days": 30}'
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

# Send single log
curl -X POST "http://localhost:8000/api/ingest/YOUR_API_TOKEN/single" \
  -H "Content-Type: application/json" \
  -d '{"level": "INFO", "message": "Hello World", "source": "my-service"}'
```

### Log Query

```bash
# Query logs
curl "http://localhost:8000/api/logs?level=ERROR&search=connection&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get statistics
curl "http://localhost:8000/api/logs/stats?hours=24" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Kubernetes Metrics

```bash
# Send K8s metrics
curl -X POST "http://localhost:8000/api/k8s/metrics/YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cluster_name": "production",
    "node_count": 3,
    "node_ready": 3,
    "pod_count": 50,
    "pod_running": 48,
    "cpu_usage_percent": 45.5,
    "memory_usage_percent": 62.3
  }'
```

## Log Entry Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `level` | string | No | DEBUG, INFO, WARNING, ERROR, CRITICAL (default: INFO) |
| `message` | string | Yes | Log message |
| `source` | string | No | Source identifier (e.g., service name, pod name) |
| `metadata` | string/object | No | Additional data (JSON) |
| `timestamp` | string | No | ISO 8601 timestamp (default: current time) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8000 |
| `POSTGRES_HOST` | PostgreSQL host | postgres |
| `POSTGRES_PORT` | PostgreSQL port | 5432 |
| `POSTGRES_USER` | PostgreSQL user | logpilot |
| `POSTGRES_PASSWORD` | PostgreSQL password | logpilot_password |
| `POSTGRES_DB` | PostgreSQL database | logpilot |
| `JWT_SECRET` | Secret key for JWT tokens | (required in production) |
| `JWT_EXPIRES_IN` | Token expiration | 24h |
| `ADMIN_API_KEY` | Admin key for cleanup endpoint | (required) |
| `STATIC_PATH` | Path to frontend files | ./static |
| `CLUSTER_MODE` | Enable Node.js multi-core clustering per pod | true |
| `WORKERS` | Number of worker processes (defaults to CPU cores) | <cpu count> |

### Horizontal and Vertical Scaling

- Vertical: The backend can utilize multiple CPU cores via Node.js clustering. Set `CLUSTER_MODE=true` and optionally `WORKERS` to a fixed number. Each pod/container will run a primary process that forks workers which share the same port.
- Horizontal: You can run multiple replicas/pods behind a load balancer or Kubernetes Service. The application is stateless; each replica can process requests independently. The internal cleanup cron runs once per process cluster (only in the primary process inside each pod).

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
│                      LogPilot                            │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   React     │  │   Express   │  │ PostgreSQL  │     │
│  │  Frontend   │◄─┤   Backend   │◄─┤  Database   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │                │                              │
│         └────────────────┼──────────────────────────────│
│                          │                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              REST API Endpoints                  │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  /api/auth/*      - Authentication              │   │
│  │  /api/systems/*   - System management           │   │
│  │  /api/ingest/*    - Log ingestion (by token)    │   │
│  │  /api/logs/*      - Log queries                 │   │
│  │  /api/k8s/*       - Kubernetes metrics          │   │
│  │  /api/admin/*     - Admin operations            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
           ▲                           ▲
           │                           │
    ┌──────┴──────┐             ┌──────┴──────┐
    │  Your Apps  │             │  K8s        │
    │  (send logs)│             │  Collector  │
    └─────────────┘             └─────────────┘
```

## Cleanup / Retention

Logs are automatically cleaned up based on each system's `retention_days` setting. The cleanup runs:

- **Automatically**: Every hour via internal cron job
- **Manually**: `POST /api/admin/cleanup?admin_key=YOUR_ADMIN_KEY`
- **CLI**: `npm run cleanup` (in backend directory)

## Security Considerations

1. **Change default secrets** in production:
   - `JWT_SECRET` - Use a strong, random string
   - `ADMIN_API_KEY` - Use a strong, random string

2. **Use HTTPS** in production (configure via ingress/reverse proxy)

3. **API tokens** are system-specific and can be regenerated

4. **Rate limiting** is enabled for log ingestion (1000 req/min per token)

## License

MIT License
