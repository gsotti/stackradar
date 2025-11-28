# LogPilot Kubernetes Collector - Deployment Guide

This guide explains how to deploy the LogPilot Kubernetes Collector to your cluster using `kubectl` and a kubeconfig file.

## Prerequisites

- `kubectl` installed and configured
- Access to a Kubernetes cluster (kubeconfig file)
- Docker registry to host the collector image
- LogPilot instance URL and API token

## Step 1: Build and Push the Docker Image

First, build the Docker image and push it to your container registry:

```bash
# Navigate to the k8s-collector directory
cd k8s-collector

# Build the image (replace with your registry)
docker build -t your-registry.com/logpilot-collector:latest .

# Push to your registry
docker push your-registry.com/logpilot-collector:latest
```

**Examples for different registries:**

- **Docker Hub**: `docker.io/your-username/logpilot-collector:latest`
- **Google Container Registry**: `gcr.io/your-project/logpilot-collector:latest`
- **AWS ECR**: `123456789012.dkr.ecr.us-east-1.amazonaws.com/logpilot-collector:latest`
- **Azure ACR**: `yourregistry.azurecr.io/logpilot-collector:latest`

## Step 2: Configure the Deployment

Edit `k8s-deployment.yaml` and update the following values:

### Required Changes:

1. **LogPilot URL** (line 50):
   ```yaml
   LOGPILOT_URL: "https://your-logpilot-instance.com"
   ```

2. **API Token** (line 52):
   ```yaml
   API_TOKEN: "your-api-token-here"
   ```

3. **Docker Image** (line 82):
   ```yaml
   image: your-registry.com/logpilot-collector:latest
   ```

### Optional Changes:

1. **Cluster Name** (line 54):
   ```yaml
   CLUSTER_NAME: "production-cluster"
   ```

2. **Collection Schedule** (line 60) - default is every 5 minutes:
   ```yaml
   schedule: "*/5 * * * *"
   ```

   Common schedules:
   - Every 1 minute: `"* * * * *"`
   - Every 10 minutes: `"*/10 * * * *"`
   - Every hour: `"0 * * * *"`
   - Every 6 hours: `"0 */6 * * *"`

## Step 3: Deploy to Kubernetes

Deploy using `kubectl` with your kubeconfig:

```bash
# Set your kubeconfig (if not using default ~/.kube/config)
export KUBECONFIG=/path/to/your/kubeconfig

# Apply the deployment
kubectl apply -f k8s-deployment.yaml
```

This will create:
- Namespace: `logpilot-system`
- ServiceAccount: `logpilot-collector`
- ClusterRole with read permissions for metrics
- ClusterRoleBinding
- Secret with configuration
- CronJob to run the collector

## Step 4: Verify Deployment

Check that everything is deployed correctly:

```bash
# Check namespace
kubectl get namespace logpilot-system

# Check ServiceAccount and RBAC
kubectl get serviceaccount,clusterrole,clusterrolebinding -n logpilot-system

# Check the CronJob
kubectl get cronjob -n logpilot-system

# Check if any jobs have run
kubectl get jobs -n logpilot-system

# View logs from the most recent job
kubectl logs -n logpilot-system -l app=logpilot-collector --tail=100
```

## Step 5: Trigger a Manual Run (Optional)

To test without waiting for the schedule:

```bash
# Create a one-time job from the cronjob
kubectl create job -n logpilot-system --from=cronjob/logpilot-collector manual-test-1

# Watch the job
kubectl get jobs -n logpilot-system -w

# View logs
kubectl logs -n logpilot-system job/manual-test-1
```

## Troubleshooting

### Check CronJob status:
```bash
kubectl describe cronjob -n logpilot-system logpilot-collector
```

### Check recent jobs:
```bash
kubectl get jobs -n logpilot-system
```

### View logs from failed jobs:
```bash
kubectl logs -n logpilot-system -l app=logpilot-collector --tail=100 --previous
```

### Check RBAC permissions:
```bash
kubectl auth can-i list nodes --as=system:serviceaccount:logpilot-system:logpilot-collector
kubectl auth can-i list pods --as=system:serviceaccount:logpilot-system:logpilot-collector
```

### Common Issues:

1. **ImagePullBackOff**:
   - Ensure the image is pushed to your registry
   - Add `imagePullSecrets` if using a private registry

2. **Permission Denied**:
   - Verify ClusterRole and ClusterRoleBinding are created
   - Check ServiceAccount is properly referenced

3. **Connection Refused**:
   - Verify `LOGPILOT_URL` is correct and accessible from the cluster
   - Check if the cluster has egress network policies blocking outbound traffic

4. **Metrics Server Not Available**:
   - This is optional - the collector will work without it
   - Install metrics-server if you want CPU/Memory usage metrics

## Update Configuration

To update the configuration (URL, token, schedule):

```bash
# Edit the secret
kubectl edit secret -n logpilot-system logpilot-config

# Or delete and reapply
kubectl delete -f k8s-deployment.yaml
kubectl apply -f k8s-deployment.yaml
```

## Uninstall

To remove the collector:

```bash
kubectl delete -f k8s-deployment.yaml
```

## Using a Different Namespace

If you prefer a different namespace, replace `logpilot-system` in the YAML file:

```bash
# Using sed to replace namespace
sed 's/logpilot-system/your-namespace/g' k8s-deployment.yaml > k8s-deployment-custom.yaml
kubectl apply -f k8s-deployment-custom.yaml
```

## Security Best Practices

1. **Use a Secret for the API Token**: Already configured in the deployment
2. **Limit RBAC Permissions**: The ClusterRole only has read permissions
3. **Resource Limits**: CPU and memory limits are set to prevent resource exhaustion
4. **Network Policies**: Consider adding network policies to restrict egress traffic
5. **Image Scanning**: Scan the Docker image for vulnerabilities before deployment

## Advanced: Using ImagePullSecrets

If using a private registry, create an image pull secret:

```bash
kubectl create secret docker-registry regcred \
  --namespace=logpilot-system \
  --docker-server=your-registry.com \
  --docker-username=your-username \
  --docker-password=your-password \
  --docker-email=your-email@example.com
```

Then add to the deployment YAML under `spec.template.spec`:

```yaml
imagePullSecrets:
  - name: regcred
```
