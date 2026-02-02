#!/bin/bash

# LogRadar Log Collector Deployment Script
#
# This script builds, pushes, and deploys the log collector to Kubernetes
#
# Usage:
#   ./deploy-logs.sh [OPTIONS]

set -e

# Source .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file..."
    set -a
    source .env
    set +a
fi

# Default values
REGISTRY="${REGISTRY:-"ghcr.io/gsotti"}"
TAG="latest"
KUBECONFIG_PATH="${KUBECONFIG:-$HOME/.kube/config}"
DO_BUILD=true
DO_PUSH=true
DO_DEPLOY=true
APP_NAME="${APP_NAME:-dev}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    cat << EOF
LogRadar Log Collector Deployment Script

Usage:
    ./deploy-logs.sh [OPTIONS]

Options:
    -r, --registry REGISTRY    Docker registry (default: ghcr.io/gsotti)
    -t, --tag TAG              Image tag (default: latest)
    -k, --kubeconfig PATH      Path to kubeconfig file
    -n, --no-build             Skip building Docker image
    -p, --no-push              Skip pushing image
    -d, --no-deploy            Skip kubectl deployment
    -h, --help                 Show this help

Examples:
    ./deploy-logs.sh -r ghcr.io/myuser
    ./deploy-logs.sh -r ghcr.io/myuser -t v1.0.0
    ./deploy-logs.sh -n -p  # Only deploy
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--registry) REGISTRY="$2"; shift 2 ;;
        -t|--tag) TAG="$2"; shift 2 ;;
        -k|--kubeconfig) KUBECONFIG_PATH="$2"; shift 2 ;;
        -n|--no-build) DO_BUILD=false; shift ;;
        -p|--no-push) DO_PUSH=false; shift ;;
        -d|--no-deploy) DO_DEPLOY=false; shift ;;
        -h|--help) show_help; exit 0 ;;
        *) log_error "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

REGISTRY="${REGISTRY%/}"
LOGS_IMAGE="${REGISTRY}/logradar-log-collector:${TAG}"

log_info "=========================================="
log_info "LogRadar Log Collector Deployment"
log_info "=========================================="
log_info "Image: ${LOGS_IMAGE}"
log_info "App Name: ${APP_NAME}"
log_info "=========================================="

# Validate deployment requirements
if [ "$DO_DEPLOY" = true ]; then
    if [ -z "$LOGRADAR_URL" ]; then
        log_error "LOGRADAR_URL is not set. Set it in .env or export it."
        exit 1
    fi
    if [ -z "$API_TOKEN" ]; then
        log_error "API_TOKEN is not set. Set it in .env or export it."
        exit 1
    fi
    if [ -z "$POD_LABEL_SELECTOR" ]; then
        log_error "POD_LABEL_SELECTOR is not set. Set it in .env"
        log_error "Example: POD_LABEL_SELECTOR=app.kubernetes.io/name=my-app"
        exit 1
    fi
    if [ -z "$POD_NAMESPACE" ]; then
        log_error "POD_NAMESPACE is not set. Set it in .env"
        exit 1
    fi

    log_info "Environment:"
    log_info "  LOGRADAR_URL: ${LOGRADAR_URL}"
    log_info "  POD_NAMESPACE: ${POD_NAMESPACE}"
    log_info "  POD_LABEL_SELECTOR: ${POD_LABEL_SELECTOR}"
    log_info "  TENANT: ${TENANT:-default}"
    log_info "  ENVIRONMENT: ${ENVIRONMENT:-production}"
fi

# Build
if [ "$DO_BUILD" = true ]; then
    log_info "Building log collector image..."
    docker build --platform linux/amd64 -f log-collector/Dockerfile -t "${LOGS_IMAGE}" log-collector/
    log_success "Image built: ${LOGS_IMAGE}"
else
    log_info "Skipping build"
fi

# Push
if [ "$DO_PUSH" = true ]; then
    log_info "Pushing image..."
    docker push "${LOGS_IMAGE}"
    log_success "Image pushed: ${LOGS_IMAGE}"
else
    log_info "Skipping push"
fi

# Deploy
if [ "$DO_DEPLOY" = true ]; then
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        exit 1
    fi

    if [ -n "$KUBECONFIG_PATH" ]; then
        export KUBECONFIG="$KUBECONFIG_PATH"
    fi

    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    CONTEXT=$(kubectl config current-context)
    log_info "Target cluster: ${CONTEXT}"
    log_warning "Deployment will be applied to this cluster!"

    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cancelled"
        exit 0
    fi

    TEMP_DIR=$(mktemp -d)
    trap "rm -rf ${TEMP_DIR}" EXIT

    log_info "Preparing deployment..."
    cat log-collector/deployment.yaml | \
        sed "s|image: your-registry/logradar-log-collector:latest|image: ${LOGS_IMAGE}|g" | \
        sed "s|LOGRADAR_URL: \"https://your-logradar-instance.com\"|LOGRADAR_URL: \"${LOGRADAR_URL}\"|g" | \
        sed "s|API_TOKEN: \"your-api-token-here\"|API_TOKEN: \"${API_TOKEN}\"|g" | \
        sed "s|CLUSTER_NAME: \"my-cluster\"|CLUSTER_NAME: \"${CLUSTER_NAME:-my-cluster}\"|g" | \
        sed "s|LOG_TAIL_LINES: \"100\"|LOG_TAIL_LINES: \"${LOG_TAIL_LINES:-100}\"|g" | \
        sed "s|POLL_INTERVAL: \"1000\"|POLL_INTERVAL: \"${POLL_INTERVAL:-10000}\"|g" | \
        sed "s|FOLLOW_LOGS: \"true\"|FOLLOW_LOGS: \"${FOLLOW_LOGS:-true}\"|g" | \
        sed "s|TENANT: \"default\"|TENANT: \"${TENANT:-default}\"|g" | \
        sed "s|SYSTEM_TYPE: \"kubernetes\"|SYSTEM_TYPE: \"${SYSTEM_TYPE:-kubernetes}\"|g" | \
        sed "s|value: \"environment\"|value: \"${ENVIRONMENT:-production}\"|g" | \
        sed "s|value: \"pod_namespace\"|value: \"${POD_NAMESPACE}\"|g" | \
        sed "s|value: \"pod_label_selector\"|value: \"${POD_LABEL_SELECTOR}\"|g" | \
        sed "s|__APP_NAME__|${APP_NAME}|g" \
        > "${TEMP_DIR}/logs-deployment.yaml"

    log_info "Applying deployment..."
    kubectl apply -f "${TEMP_DIR}/logs-deployment.yaml"
    log_success "Log collector deployed!"

    log_info "=========================================="
    log_info "Deployment Status:"
    kubectl get deployment -n logradar-system -l app=logradar-log-collector

    echo ""
    log_info "Useful commands:"
    echo "  kubectl get pods -n logradar-system -l app=logradar-log-collector"
    echo "  kubectl logs -n logradar-system -l app=logradar-log-collector --tail=50 -f"
    echo "  kubectl describe deployment -n logradar-system logradar-log-collector-${APP_NAME}"
else
    log_info "Skipping deployment"
fi

log_success "Done!"
