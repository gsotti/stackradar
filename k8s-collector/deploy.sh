#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}LogPilot Kubernetes Collector - Deployment Script${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    echo "Please install kubectl and configure your kubeconfig"
    exit 1
fi

# Check kubectl access
if ! kubectl version --short &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    echo "Please ensure your kubeconfig is properly configured"
    echo "Current kubeconfig: ${KUBECONFIG:-~/.kube/config}"
    exit 1
fi

echo -e "${GREEN}✓ kubectl is configured${NC}"
echo ""

# Prompt for required values
echo -e "${YELLOW}Please provide the following information:${NC}"
echo ""

read -p "LogPilot URL (e.g., https://logpilot.example.com): " LOGPILOT_URL
if [ -z "$LOGPILOT_URL" ]; then
    echo -e "${RED}Error: LogPilot URL is required${NC}"
    exit 1
fi

read -p "API Token: " API_TOKEN
if [ -z "$API_TOKEN" ]; then
    echo -e "${RED}Error: API Token is required${NC}"
    exit 1
fi

read -p "Docker Image (e.g., your-registry.com/logpilot-collector:latest): " DOCKER_IMAGE
if [ -z "$DOCKER_IMAGE" ]; then
    echo -e "${RED}Error: Docker Image is required${NC}"
    exit 1
fi

read -p "Cluster Name [default]: " CLUSTER_NAME
CLUSTER_NAME=${CLUSTER_NAME:-default}

read -p "Namespace [logpilot-system]: " NAMESPACE
NAMESPACE=${NAMESPACE:-logpilot-system}

read -p "Schedule (cron format) [*/5 * * * *]: " SCHEDULE
SCHEDULE=${SCHEDULE:-"*/5 * * * *"}

echo ""
echo -e "${YELLOW}Configuration Summary:${NC}"
echo "  LogPilot URL: $LOGPILOT_URL"
echo "  Cluster Name: $CLUSTER_NAME"
echo "  Namespace: $NAMESPACE"
echo "  Docker Image: $DOCKER_IMAGE"
echo "  Schedule: $SCHEDULE"
echo ""

read -p "Deploy with these settings? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo -e "${GREEN}Deploying LogPilot Collector...${NC}"

# Create temporary deployment file
TEMP_FILE=$(mktemp)

cat > "$TEMP_FILE" << EOF
---
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: logpilot-collector
  namespace: ${NAMESPACE}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: logpilot-collector
rules:
  - apiGroups: [""]
    resources:
      - nodes
      - pods
      - services
      - persistentvolumeclaims
      - namespaces
    verbs: ["get", "list"]
  - apiGroups: ["apps"]
    resources:
      - deployments
    verbs: ["get", "list"]
  - apiGroups: ["metrics.k8s.io"]
    resources:
      - nodes
      - pods
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: logpilot-collector
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: logpilot-collector
subjects:
  - kind: ServiceAccount
    name: logpilot-collector
    namespace: ${NAMESPACE}
---
apiVersion: v1
kind: Secret
metadata:
  name: logpilot-config
  namespace: ${NAMESPACE}
type: Opaque
stringData:
  LOGPILOT_URL: "${LOGPILOT_URL}"
  API_TOKEN: "${API_TOKEN}"
  CLUSTER_NAME: "${CLUSTER_NAME}"
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: logpilot-collector
  namespace: ${NAMESPACE}
spec:
  schedule: "${SCHEDULE}"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: logpilot-collector
        spec:
          serviceAccountName: logpilot-collector
          restartPolicy: OnFailure
          containers:
            - name: collector
              image: ${DOCKER_IMAGE}
              imagePullPolicy: Always
              envFrom:
                - secretRef:
                    name: logpilot-config
              resources:
                requests:
                  memory: "64Mi"
                  cpu: "100m"
                limits:
                  memory: "128Mi"
                  cpu: "200m"
EOF

# Apply the deployment
kubectl apply -f "$TEMP_FILE"

# Clean up
rm "$TEMP_FILE"

echo ""
echo -e "${GREEN}✓ Deployment successful!${NC}"
echo ""
echo "Verify deployment:"
echo "  kubectl get cronjob -n ${NAMESPACE}"
echo "  kubectl get jobs -n ${NAMESPACE}"
echo ""
echo "View logs:"
echo "  kubectl logs -n ${NAMESPACE} -l app=logpilot-collector --tail=100"
echo ""
echo "Trigger manual run:"
echo "  kubectl create job -n ${NAMESPACE} --from=cronjob/logpilot-collector manual-test-1"
echo ""
echo "Uninstall:"
echo "  kubectl delete namespace ${NAMESPACE}"
echo "  kubectl delete clusterrole logpilot-collector"
echo "  kubectl delete clusterrolebinding logpilot-collector"
