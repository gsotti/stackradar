# stackradar Stats Collector

Collects cluster-wide Kubernetes metrics and sends them to stackradar.

## What it collects

- Node count and health status
- Pod counts by phase (Running, Pending, Failed)
- Deployment readiness
- Service count
- Persistent Volume Claim status
- CPU and memory usage (requires metrics-server)
- Namespace list
- Automated alerts for cluster issues

## How it works

Runs as a **Deployment** with a continuous loop that collects metrics from the Kubernetes API and sends them to stackradar every 10 seconds (configurable).

## Configuration

Required environment variables (set in `deployment.yaml`):

- `STACKRADAR_URL` - Your stackradar instance URL
- `API_TOKEN` - API token for authentication
- `CLUSTER_NAME` - Name of your cluster (optional, default: "default")
- `COLLECTION_INTERVAL` - Collection interval in milliseconds (optional, default: 10000 = 10 seconds)

## Deployment

### Using the deployment script (recommended)

From the parent directory:

```bash
cd ..
./deploy-collectors.sh -r your-registry -s
```

### Manual deployment

1. **Build the Docker image:**

```bash
docker build -t your-registry/stackradar-stats-collector:latest .
docker push your-registry/stackradar-stats-collector:latest
```

2. **Update `deployment.yaml`:**
   - Set your `STACKRADAR_URL` in the Secret
   - Set your `API_TOKEN` in the Secret
   - Update the image name if using a different registry

3. **Deploy to Kubernetes:**

```bash
kubectl apply -f deployment.yaml
```

## Verify deployment

```bash
# Check if Deployment was created
kubectl get deployment -n stackradar-system stackradar-stats-collector

# Check pods
kubectl get pods -n stackradar-system -l app=stackradar-stats-collector

# View logs (follow mode to see continuous collection)
kubectl logs -n stackradar-system -l app=stackradar-stats-collector --tail=50 -f
```

## Adjust Collection Interval

To change the collection interval, edit the `COLLECTION_INTERVAL` environment variable in `deployment.yaml`:

```yaml
env:
  - name: COLLECTION_INTERVAL
    value: "10000"  # milliseconds (10 seconds)
```

Examples:
- `5000` = 5 seconds
- `10000` = 10 seconds (default)
- `30000` = 30 seconds
- `60000` = 1 minute

## RBAC Permissions

The stats collector requires read-only access to:
- nodes
- pods
- services
- persistentvolumeclaims
- persistentvolumes
- namespaces
- deployments (apps/v1)
- metrics.k8s.io API (optional, for CPU/memory metrics)

All permissions are defined in `deployment.yaml`.
