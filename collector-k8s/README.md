# StackRadar Kubernetes Collectors

Two specialized collectors for comprehensive Kubernetes monitoring with StackRadar:

- **Stats Collector** — cluster-wide metrics and health monitoring
- **Logs Collector** — pod log streaming to StackRadar

> **Note on registry owner**: All image and chart references below use `gsotti` as the registry owner. This is the default value configurable in StackRadar's superadmin settings under **System Settings → Container Registry Owner**.

---

## Installation Methods

Choose the method that best fits your workflow:

- [Method 1: kubectl (raw YAML)](#method-1-kubectl-raw-yaml)
- [Method 2: Helm](#method-2-helm)
- [Method 3: Helmfile](#method-3-helmfile)

---

## Method 1: kubectl (raw YAML)

Use this approach to deploy the collectors by applying Kubernetes manifests directly.

### 1. Configure Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```bash
STACKRADAR_URL=https://your-stackradar-instance.com
API_TOKEN=your-api-token-here
CLUSTER_NAME=my-cluster  # optional
```

### 2. Deploy Both Collectors

```bash
./deploy-collectors.sh
```

Or with a custom registry owner:

```bash
./deploy-collectors.sh -r ghcr.io/gsotti
```

This will:
- Load configuration from `.env` file
- Build both Docker images (`ghcr.io/gsotti/stackradar-stats-collector`, `ghcr.io/gsotti/stackradar-logs-collector`)
- Push to the registry
- Deploy to your Kubernetes cluster with your StackRadar credentials

### 3. Deploy Only Stats Collector

```bash
./deploy-collectors.sh -s
```

### 4. Deploy Only Log Collector

```bash
./deploy-collectors.sh -l
```

> **Important**: After deploying the log collector, edit `log-collector/deployment.yaml` to specify which pod to monitor.

### Image References

| Collector | Image |
|-----------|-------|
| Stats Collector | `ghcr.io/gsotti/stackradar-stats-collector:latest` |
| Logs Collector | `ghcr.io/gsotti/stackradar-logs-collector:latest` |

Replace `gsotti` with the registry owner configured in your StackRadar instance.

### Deployment Script Options

```bash
./deploy-collectors.sh [OPTIONS]

Required:
  -r, --registry REGISTRY    Docker registry (e.g., ghcr.io/gsotti)

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

#### Examples

```bash
# Build and deploy everything with custom tag
./deploy-collectors.sh -r ghcr.io/gsotti -t v1.2.0

# Only build images, don't push or deploy
./deploy-collectors.sh -r ghcr.io/gsotti -p -d

# Deploy using existing images (no build, no push)
./deploy-collectors.sh -r ghcr.io/gsotti -n -p

# Deploy only log collector with version tag
./deploy-collectors.sh -r ghcr.io/gsotti -t v2.0.0 -l
```

---

## Method 2: Helm

Install the collectors using Helm charts published to the OCI registry at `ghcr.io/gsotti/charts`.

### Prerequisites

- Helm v3.8+ (OCI support is built-in)

### Install Stats Collector

```bash
helm install stackradar-stats-collector oci://ghcr.io/gsotti/charts/stackradar-stats-collector \
  --namespace stackradar-system --create-namespace \
  --set stackradar.url=https://your-stackradar-instance.com \
  --set stackradar.apiToken=your-api-token \
  --set collector.clusterName=my-cluster
```

### Install Logs Collector

```bash
helm install stackradar-logs-collector oci://ghcr.io/gsotti/charts/stackradar-logs-collector \
  --namespace stackradar-system \
  --set stackradar.url=https://your-stackradar-instance.com \
  --set stackradar.apiToken=your-api-token \
  --set collector.podNamespace=default \
  --set collector.podLabelSelector=app=my-app
```

### Upgrade

```bash
helm upgrade stackradar-stats-collector oci://ghcr.io/gsotti/charts/stackradar-stats-collector \
  --namespace stackradar-system \
  --reuse-values

helm upgrade stackradar-logs-collector oci://ghcr.io/gsotti/charts/stackradar-logs-collector \
  --namespace stackradar-system \
  --reuse-values
```

### Uninstall

```bash
helm uninstall stackradar-stats-collector -n stackradar-system
helm uninstall stackradar-logs-collector -n stackradar-system
```

---

## Method 3: Helmfile

Use Helmfile to manage both collectors as a single deployment unit. A ready-to-use example is provided in [`helmfile.yaml.example`](./helmfile.yaml.example).

### Prerequisites

- Helm v3.8+
- [Helmfile](https://helmfile.readthedocs.io/en/latest/#installation)

### Setup

1. Copy the example file:

```bash
cp helmfile.yaml.example helmfile.yaml
```

2. Edit `helmfile.yaml` and replace the placeholder values:

```yaml
repositories:
  - name: stackradar
    url: oci://ghcr.io/gsotti/charts

releases:
  - name: stackradar-stats-collector
    chart: stackradar/stackradar-stats-collector
    namespace: stackradar-system
    createNamespace: true
    values:
      - stackradar:
          url: https://your-stackradar-instance.com
          apiToken: your-api-token
          clusterName: my-cluster

  - name: stackradar-logs-collector
    chart: stackradar/stackradar-logs-collector
    namespace: stackradar-system
    values:
      - stackradar:
          url: https://your-stackradar-instance.com
          apiToken: your-api-token
        collector:
          podNamespace: default
          podLabelSelector: app=my-app
```

3. Apply:

```bash
helmfile apply
```

### Helmfile Commands

```bash
# Preview changes without applying
helmfile diff

# Apply all releases
helmfile apply

# Sync (equivalent to apply)
helmfile sync

# Destroy all releases
helmfile destroy
```

---

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

### Log Collector

**Purpose**: Application log streaming from specific pods

**Runs as**: Deployment (continuous)

**Collects**:
- Real-time logs from targeted pods
- Automatic log level detection
- Container-specific logs

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STACKRADAR_URL` | Yes | — | Base URL of your StackRadar instance |
| `API_TOKEN` | Yes | — | Site API token from StackRadar |
| `CLUSTER_NAME` | No | `my-cluster` | Cluster identifier shown in StackRadar |
| `COLLECTION_INTERVAL` | No | `10000` | Stats collection interval in ms |
| `POLL_INTERVAL` | No | `1000` | Log collector poll interval in ms |
| `LOG_TAIL_LINES` | No | `100` | Number of tail lines for log collector |
| `FOLLOW_LOGS` | No | `true` | Enable follow mode for log collector |
| `POD_NAMESPACE` | No | — | Namespace to watch (log collector) |
| `POD_LABEL_SELECTOR` | No | — | Label selector for pods (log collector) |

### Manual Configuration (kubectl only)

If you prefer to edit deployment files directly instead of using `.env`:

**Stats Collector Secret** (`stats-collector/deployment.yaml`):
```yaml
stringData:
  STACKRADAR_URL: "https://your-stackradar.com"
  API_TOKEN: "your-api-token"
  CLUSTER_NAME: "production-cluster"
```

**Log Collector Secret** (`log-collector/deployment.yaml`):
```yaml
stringData:
  STACKRADAR_URL: "https://your-stackradar.com"
  API_TOKEN: "your-api-token"
  CLUSTER_NAME: "production-cluster"
  LOG_TAIL_LINES: "100"
  POLL_INTERVAL: "1000"
  FOLLOW_LOGS: "true"
```

---

## Monitoring Deployments

### Stats Collector

```bash
# View deployment
kubectl get deployment -n stackradar-system -l app=stackradar-stats-collector

# View pods
kubectl get pods -n stackradar-system -l app=stackradar-stats-collector

# View logs (follow for continuous updates)
kubectl logs -n stackradar-system -l app=stackradar-stats-collector --tail=50 -f
```

### Log Collector

```bash
# View deployment
kubectl get deployment -n stackradar-system -l app=stackradar-log-collector

# View pods
kubectl get pods -n stackradar-system -l app=stackradar-log-collector

# Follow logs
kubectl logs -n stackradar-system -l app=stackradar-log-collector --tail=50 -f
```

---

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
                                    │  StackRadar API  │
                                    │                  │
                                    │  /api/k8s/metrics│
                                    │  /api/ingest     │
                                    └──────────────────┘
```

---

## Security

Both collectors use:
- Separate Kubernetes ServiceAccounts
- Minimal RBAC permissions (ClusterRole)
- Read-only access to Kubernetes resources
- Kubernetes Secrets for sensitive configuration

---

## Troubleshooting

### Images not pulling

Ensure you're authenticated to the registry:
```bash
docker login ghcr.io
# or for Helm OCI
helm registry login ghcr.io
```

### Images not building (kubectl method)

Make sure Docker is running:
```bash
docker ps
```

### Deployments failing

Check if namespace exists:
```bash
kubectl get namespace stackradar-system
```

View deployment errors:
```bash
kubectl describe deployment -n stackradar-system -l app=stackradar-stats-collector
kubectl describe deployment -n stackradar-system -l app=stackradar-log-collector
```

### No data appearing in StackRadar

1. Check collector logs for errors
2. Verify `STACKRADAR_URL` is correct and reachable from within the cluster
3. Verify `API_TOKEN` is valid for the target site
4. Check network policies allow egress to StackRadar

---

## Directory Structure

```
collector-k8s/
├── stats-collector/          # Cluster metrics collector
│   ├── stats-collector.mjs   # Node.js collector script
│   ├── Dockerfile            # Docker image for stats
│   ├── deployment.yaml       # Kubernetes Deployment
│   └── README.md             # Stats collector docs
│
├── log-collector/            # Pod log collector
│   ├── log-collector.mjs     # Node.js collector script
│   ├── Dockerfile            # Docker image for logs
│   ├── deployment.yaml       # Kubernetes Deployment
│   └── README.md             # Log collector docs
│
├── deploy-collectors.sh      # Automated deployment script
├── helmfile.yaml.example     # Helmfile example
└── README.md                 # This file
```

---

## Notes

- Namespace used by both collectors: `stackradar-system`
- Labels:
  - Stats: `app=stackradar-stats-collector`
  - Logs: `app=stackradar-log-collector`, plus optional `target=<your-label>`
- Log collector requires you to set at least `POD_NAMESPACE` and either `POD_NAME` or `POD_LABEL_SELECTOR` before deploying.
- The registry owner (`gsotti` in all examples) can be changed in **StackRadar Superadmin → System Settings**.
