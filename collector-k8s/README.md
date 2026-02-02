# LogRadar Kubernetes Collectors

Two specialized collectors for comprehensive Kubernetes monitoring with LogRadar.

## Directory Structure

```
k8s-collector/
├── stats-collector/          # Cluster metrics collector
│   ├── stats-collector.mjs   # Node.js collector script
│   ├── Dockerfile            # Docker image for stats
│   ├── deployment.yaml       # Kubernetes Deployment
│   └── README.md            # Stats collector docs
│
├── log-collector/            # Pod log collector
│   ├── log-collector.mjs    # Node.js collector script
│   ├── Dockerfile           # Docker image for logs
│   ├── deployment.yaml      # Kubernetes Deployment
│   └── README.md           # Log collector docs
│
├── deploy-collectors.sh     # Automated deployment script
└── README.md               # This file
```

## Quick Start

### 1. Configure Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```bash
LOGRADAR_URL=https://your-logradar-instance.com
API_TOKEN=your-api-token-here
CLUSTER_NAME=my-cluster  # optional
```

### 2. Deploy Both Collectors

```bash
./deploy-collectors.sh -r your-registry/username
```

Or simply (uses default registry from script):

```bash
./deploy-collectors.sh
```

This will:
- Load configuration from `.env` file
- Build both Docker images
- Push to your registry
- Deploy to your Kubernetes cluster with your LogRadar credentials

### 3. Deploy Only Stats Collector

```bash
./deploy-collectors.sh -s
```

### 4. Deploy Only Log Collector

```bash
./deploy-collectors.sh -l
```

**Important**: After deploying the log collector, edit `log-collector/deployment.yaml` to specify which pod to monitor!

## Collectors Overview

### Stats Collector

**Purpose**: Cluster-wide metrics and health monitoring

**Runs as**: Deployment (continuous, every 10 seconds)

**Collects**:
- Node status
- Pod counts and phases
- Deployment readiness
- Service counts
- PVC status
- CPU/memory usage
- Cluster alerts

📖 [Full Stats Collector Documentation](stats-collector/README.md)

### Log Collector

**Purpose**: Application log streaming from specific pods

**Runs as**: Deployment (continuous)

**Collects**:
- Real-time logs from one specified pod
- Automatic log level detection
- Container-specific logs

📖 [Full Log Collector Documentation](log-collector/README.md)

## Deployment Script Options

```bash
./deploy-collectors.sh [OPTIONS]

Required:
  -r, --registry REGISTRY    Docker registry (e.g., ghcr.io/username)

Optional:
  -t, --tag TAG              Image tag (default: latest)
  -k, --kubeconfig PATH      Path to kubeconfig file (default: $KUBECONFIG or ~/.kube/config)
  -s, --stats-only           Deploy only stats collector
  -l, --logs-only            Deploy only log collector
  -n, --no-build             Skip building images
  -p, --no-push              Skip pushing images
  -d, --no-deploy            Skip kubectl deployment
  -h, --help                 Show help
```

### Examples

```bash
# Build and deploy everything with custom tag
./deploy-collectors.sh -r ghcr.io/myuser -t v1.2.0

# Only build images, don't push or deploy
./deploy-collectors.sh -r ghcr.io/myuser -p -d

# Deploy using existing images
./deploy-collectors.sh -r ghcr.io/myuser -n -p

# Deploy only log collector with version tag
./deploy-collectors.sh -r docker.io/username -t v2.0.0 -l
```

## Configuration

### Environment Variables (.env file)

The deployment script automatically loads configuration from a `.env` file:

```bash
# Required
LOGRADAR_URL=https://your-logradar-instance.com
API_TOKEN=your-api-token-here

# Optional
CLUSTER_NAME=production-cluster
KUBECONFIG=/path/to/kubeconfig
APP_NAME=dev
COLLECTION_INTERVAL=10000   # Stats collection interval in ms
POLL_INTERVAL=1000          # Log collector poll interval in ms
LOG_TAIL_LINES=100          # Log collector tail lines
FOLLOW_LOGS=true            # Log collector follow mode
```

**Setup:**

1. Copy the example file: `cp .env.example .env`
2. Edit `.env` with your values
3. Run `./deploy-collectors.sh`

The script will:
- ✅ Validate required variables (LOGRADAR_URL, API_TOKEN)
- ✅ Automatically inject them into Kubernetes Secrets
- ✅ Use CLUSTER_NAME if provided, or default to "my-cluster"
- ✅ Show first 8 characters of API_TOKEN for verification (security)

### Manual Configuration (Advanced)

If you prefer to manually edit deployment files instead of using `.env`:

**Stats Collector Secret** (`stats-collector/deployment.yaml`):
```yaml
stringData:
  LOGRADAR_URL: "https://your-logradar.com"
  API_TOKEN: "your-api-token"
  CLUSTER_NAME: "production-cluster"
```

**Log Collector Secret** (`log-collector/deployment.yaml`):
```yaml
stringData:
  LOGRADAR_URL: "https://your-logradar.com"
  API_TOKEN: "your-api-token"
  CLUSTER_NAME: "production-cluster"
  LOG_TAIL_LINES: "100"
  POLL_INTERVAL: "1000"
  FOLLOW_LOGS: "true"
```

## Monitoring Deployments

### Stats Collector

```bash
# View deployment
kubectl get deployment -n logradar-system -l app=logradar-stats-collector

# View pods
kubectl get pods -n logradar-system -l app=logradar-stats-collector

# View logs (follow for continuous updates)
kubectl logs -n logradar-system -l app=logradar-stats-collector --tail=50 -f
```

### Log Collector

```bash
# View deployment
kubectl get deployment -n logradar-system -l app=logradar-log-collector

# View pods
kubectl get pods -n logradar-system -l app=logradar-log-collector

# Follow logs
kubectl logs -n logradar-system -l app=logradar-log-collector --tail=50 -f
```

## Architecture

```
┌─────────────────────────────────────────────┐
│         Kubernetes Cluster                   │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │  Stats Collector (Deployment)      │     │
│  │  - Runs continuously (10s interval)│────┐│
│  │  - Collects cluster metrics        │    ││
│  └────────────────────────────────────┘    ││
│                                             ││
│  ┌────────────────────────────────────┐    ││
│  │  Log Collector (Deployment)        │    ││
│  │  - Targets specific pod            │────┤│
│  │  - Continuous log streaming        │    ││
│  └────────────────────────────────────┘    ││
│                                             ││
└─────────────────────────────────────────────┘│
                                               │
                                               ▼
                                    ┌──────────────────┐
                                    │   LogRadar API   │
                                    │                  │
                                    │  /api/k8s/metrics│
                                    │  /api/ingest     │
                                    └──────────────────┘
```

## Security

Both collectors use:
- Separate Kubernetes ServiceAccounts
- Minimal RBAC permissions (ClusterRole)
- Read-only access to Kubernetes resources
- Secrets for sensitive configuration

## Troubleshooting

### Images not building

Make sure Docker is running:
```bash
docker ps
```

### Images not pushing

Ensure you're logged into your registry:
```bash
docker login your-registry
```

### Deployments failing

Check if namespace exists:
```bash
kubectl get namespace logradar-system
```

View deployment errors:
```bash
kubectl describe deployment -n logradar-system -l app=logradar-stats-collector
kubectl describe deployment -n logradar-system -l app=logradar-log-collector
```

### No logs appearing in LogRadar

1. Check collector logs for errors
2. Verify `LOGRADAR_URL` is correct and accessible
3. Verify `API_TOKEN` is valid
4. Check network policies allow egress to LogRadar

## Migration from Old Setup

If you were using the old `collect.mjs`:

1. The stats collection is now in `stats-collector/`
2. The log collection is now in `log-collector/`
3. Update your deployments to use the new separate images
4. Benefits: Better resource allocation, easier scaling, clearer monitoring

## Notes

- Namespace used by both collectors: `logradar-system`
- Labels:
  - Stats: `app=logradar-stats-collector`
  - Logs: `app=logradar-log-collector`, plus optional `target=<your-label>`
- Log collector requires you to set at least `POD_NAMESPACE` and either `POD_NAME` or `POD_LABEL_SELECTOR` in the deployment or via environment before deploying.

## Contributing

When making changes:

1. Update the respective collector's script in its folder
2. Update the Dockerfile if dependencies change
3. Test locally with Docker
4. Update the deployment.yaml if env vars change
5. Update the README.md in the collector's folder
