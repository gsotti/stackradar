# LogPilot Kubernetes Collector

Collects Kubernetes cluster metrics and sends them to LogPilot.

## Quick Start

### Option 1: Interactive Deployment Script

The easiest way to deploy:

```bash
./deploy.sh
```

The script will prompt you for:
- LogPilot URL
- API Token
- Docker Image location
- Cluster Name
- Namespace (default: logpilot-system)
- Collection schedule (default: every 5 minutes)

### Option 2: Manual Deployment

1. **Build and push the Docker image:**

```bash
docker build -t your-registry.com/logpilot-collector:latest .
docker push your-registry.com/logpilot-collector:latest
```

2. **Edit `k8s-deployment.yaml`:**
   - Update `LOGPILOT_URL` (line 57)
   - Update `API_TOKEN` (line 59)
   - Update `CLUSTER_NAME` (line 61)
   - Update `image` (line 82)

3. **Deploy to Kubernetes:**

```bash
kubectl apply -f k8s-deployment.yaml
```

## What Gets Deployed

- **Namespace**: `logpilot-system`
- **ServiceAccount**: With read-only access to cluster resources
- **ClusterRole/ClusterRoleBinding**: RBAC permissions for metrics collection
- **Secret**: Configuration (URL, token, cluster name)
- **CronJob**: Runs the collector on schedule (default: every 5 minutes)

## Collected Metrics

The collector gathers:
- Node count and health status
- Pod counts by status (Running, Pending, Failed)
- Deployment health
- Service count
- PersistentVolumeClaim status
- Namespace list
- CPU and Memory usage (if metrics-server is installed)
- Automatic alerts for unhealthy resources

## Verify Deployment

```bash
# Check the CronJob
kubectl get cronjob -n logpilot-system

# View recent jobs
kubectl get jobs -n logpilot-system

# Check logs
kubectl logs -n logpilot-system -l app=logpilot-collector --tail=100
```

## Trigger Manual Run

To test without waiting for the schedule:

```bash
kubectl create job -n logpilot-system --from=cronjob/logpilot-collector manual-test-1
kubectl logs -n logpilot-system job/manual-test-1 -f
```

## Troubleshooting

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting steps.

Common issues:
- **ImagePullBackOff**: Image not available in registry
- **Permission Denied**: RBAC not configured correctly
- **Connection Refused**: LogPilot URL not accessible from cluster

## Uninstall

```bash
kubectl delete -f k8s-deployment.yaml
```

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide with troubleshooting

## Requirements

- Kubernetes cluster 1.19+
- kubectl configured with cluster access
- Container registry for hosting the image
- LogPilot instance with API token
