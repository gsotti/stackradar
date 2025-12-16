#!/bin/bash

# LogRadar Stats Collector Deployment Script
#
# This script builds, pushes, and deploys the stats collector to Kubernetes
#
# Usage:
#   ./deploy-stats.sh [OPTIONS]

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
LogRadar Stats Collector Deployment Script

Usage:
    ./deploy-stats.sh [OPTIONS]

Options:
    -r, --registry REGISTRY    Docker registry (default: ghcr.io/gsotti)
    -t, --tag TAG              Image tag (default: latest)
    -k, --kubeconfig PATH      Path to kubeconfig file
    -n, --no-build             Skip building Docker image
    -p, --no-push              Skip pushing image
    -d, --no-deploy            Skip kubectl deployment
    -h, --help                 Show this help

Examples:
    ./deploy-stats.sh -r ghcr.io/myuser
    ./deploy-stats.sh -r ghcr.io/myuser -t v1.0.0
    ./deploy-stats.sh -n -p  # Only deploy
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
STATS_IMAGE="${REGISTRY}/logradar-stats-collector:${TAG}"

log_info "=========================================="
log_info "LogRadar Stats Collector Deployment"
log_info "=========================================="
log_info "Image: ${STATS_IMAGE}"
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

    log_info "Environment:"
    log_info "  LOGRADAR_URL: ${LOGRADAR_URL}"
    log_info "  CLUSTER_NAME: ${CLUSTER_NAME:-my-cluster}"
    log_info "  COLLECTION_INTERVAL: ${COLLECTION_INTERVAL:-10000}ms"
fi

# Build
if [ "$DO_BUILD" = true ]; then
    log_info "Building stats collector image..."
    docker build --platform linux/amd64 -f stats-collector/Dockerfile -t "${STATS_IMAGE}" stats-collector/
    log_success "Image built: ${STATS_IMAGE}"
else
    log_info "Skipping build"
fi

# Push
if [ "$DO_PUSH" = true ]; then
    log_info "Pushing image..."
    docker push "${STATS_IMAGE}"
    log_success "Image pushed: ${STATS_IMAGE}"
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
    cat stats-collector/deployment.yaml | \
        sed "s|image: your-registry/logradar-stats-collector:latest|image: ${STATS_IMAGE}|g" | \
        sed "s|LOGRADAR_URL: \"https://your-logradar-instance.com\"|LOGRADAR_URL: \"${LOGRADAR_URL}\"|g" | \
        sed "s|API_TOKEN: \"your-api-token-here\"|API_TOKEN: \"${API_TOKEN}\"|g" | \
        sed "s|CLUSTER_NAME: \"my-cluster\"|CLUSTER_NAME: \"${CLUSTER_NAME:-my-cluster}\"|g" | \
        sed "s|COLLECTION_INTERVAL: \"10000\"|COLLECTION_INTERVAL: \"${COLLECTION_INTERVAL:-10000}\"|g" \
        > "${TEMP_DIR}/stats-deployment.yaml"

    log_info "Applying deployment..."
    kubectl apply -f "${TEMP_DIR}/stats-deployment.yaml"
    log_success "Stats collector deployed!"

    log_info "=========================================="
    log_info "Deployment Status:"
    kubectl get deployment -n logradar-system "logradar-stats-collector"

    echo ""
    log_info "Useful commands:"
    echo "  kubectl get pods -n logradar-system -l app=logradar-stats-collector"
    echo "  kubectl logs -n logradar-system -l app=logradar-stats-collector --tail=50 -f"
    echo "  kubectl describe deployment -n logradar-system logradar-stats-collector"
else
    log_info "Skipping deployment"
fi

log_success "Done!"
