# LogRadar Log Collector

Collects logs from a specific Kubernetes pod and sends them to LogRadar.

## What it collects

- Real-time logs from a single specified pod
- Can target specific containers within multi-container pods
- Automatically detects log levels (ERROR, WARNING, INFO, DEBUG)
- Includes metadata: cluster, namespace, pod name, container name

## How it works

Runs as a **Deployment** that continuously polls the Kubernetes API for new logs from the specified pod and sends them to LogRadar.

## Configuration

Required environment variables (set in `deployment.yaml`):

- `LOGRADAR_URL` - Your LogRadar instance URL
- `API_TOKEN` - API token for authentication
- `POD_NAMESPACE` - Namespace of the pod to monitor
- **Either:**
  - `POD_NAME` - Exact name of the pod to monitor (e.g., "my-pod-abc123-xyz")
  - **OR**
  - `POD_LABEL_SELECTOR` - Label selector to find the pod (e.g., "app.kubernetes.io/name=api-chart,system=dev")

Optional environment variables:

- `CONTAINER_NAME` - Specific container name (if pod has multiple containers)
- `CLUSTER_NAME` - Name of your cluster (default: "default")
- `LOG_TAIL_LINES` - Number of initial log lines to collect (default: 100)
- `POLL_INTERVAL` - Polling interval in milliseconds (default: 10000)
- `FOLLOW_LOGS` - Continuously follow logs (default: true)

### Pod Name vs Label Selector

**Use `POD_NAME`** when you know the exact pod name and it doesn't change.

**Use `POD_LABEL_SELECTOR`** (recommended) when pods are managed by Deployments/StatefulSets and their names change when restarted. The collector will automatically find the pod matching the labels.

Example label selectors:
- `"app=nginx"` - Single label
- `"app=nginx,environment=production"` - Multiple labels (comma-separated)
- `"app.kubernetes.io/name=api-chart,system=dev"` - Kubernetes standard labels

## Use Cases

Deploy **one log collector per application** you want to monitor. Each collector instance targets a specific pod.

### Example 1: Monitor nginx pod using label selector (recommended)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: logradar-log-collector-nginx
  namespace: logradar-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: logradar-log-collector
      target: nginx
  template:
    metadata:
      labels:
        app: logradar-log-collector
        target: nginx
    spec:
      serviceAccountName: logradar-log-collector
      containers:
        - name: log-collector
          image: your-registry/logradar-log-collector:latest
          env:
            - name: POD_NAMESPACE
              value: "production"
            - name: POD_LABEL_SELECTOR
              value: "app=nginx,environment=production"
            - name: CONTAINER_NAME
              value: "nginx"
          envFrom:
            - secretRef:
                name: logradar-log-config
```

### Example 2: Monitor specific pod by exact name

```yaml
env:
  - name: POD_NAMESPACE
    value: "production"
  - name: POD_NAME
    value: "nginx-deployment-abc123-xyz"
  - name: CONTAINER_NAME
    value: "nginx"
```

## Deployment

### Using the deployment script (recommended)

From the parent directory:

```bash
cd ..
./deploy-collectors.sh -r your-registry -l
```

**Important**: After deployment, edit `deployment.yaml` to set `POD_NAMESPACE` and `POD_NAME` for your target pod!

### Manual deployment

1. **Build the Docker image:**

```bash
docker build -t your-registry/logradar-log-collector:latest .
docker push your-registry/logradar-log-collector:latest
```

2. **Update `deployment.yaml`:**
   - Set your `LOGRADAR_URL` in the Secret
   - Set your `API_TOKEN` in the Secret
   - Set `POD_NAMESPACE` and `POD_NAME` in the Deployment
   - Update the image name if using a different registry

3. **Deploy to Kubernetes:**

```bash
kubectl apply -f deployment.yaml
```

## Verify deployment

```bash
# Check if deployment was created
kubectl get deployment -n logradar-system -l app=logradar-log-collector

# View pods
kubectl get pods -n logradar-system -l app=logradar-log-collector

# View logs (to see what the collector is doing)
kubectl logs -n logradar-system -l app=logradar-log-collector --tail=50 -f
```

## RBAC Permissions

The log collector requires read-only access to:
- pods
- pods/log

All permissions are defined in `deployment.yaml`.

## Tips

- Deploy multiple log collectors to monitor different pods
- Use labels to organize collectors by application
- Adjust `POLL_INTERVAL` based on log volume (lower for high-volume apps)
- Set `LOG_TAIL_LINES` higher if you need more historical logs on startup
