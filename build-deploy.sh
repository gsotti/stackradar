#!/bin/bash

# StackRadar Build and Deploy Script
#
# Usage:
#   ./build-deploy.sh [OPTIONS]

set -e

# Default values
REGISTRY="${REGISTRY:-ghcr.io/gsotti}"
IMAGE_NAME="stackradar"
HELM_RELEASE="stackradar"
HELM_NAMESPACE="stackradar"
HELM_VALUES=""
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
StackRadar Build and Deploy Script

Usage:
    ./build-deploy.sh [OPTIONS]

Options:
    -r, --registry REGISTRY    Docker registry (default: ghcr.io/gsotti)
    -t, --tag TAG              Image tag (default: version from Chart.yaml)
    -n, --namespace NS         Kubernetes namespace (default: stackradar)
    -f, --values FILE          Helm values file
    --no-build                 Skip building Docker image
    --no-push                  Skip pushing image to registry
    --no-deploy                Skip Helm deployment
    --build-only               Only build (no push, no deploy)
    -h, --help                 Show this help

Examples:
    ./build-deploy.sh                           # Full build, push, deploy
    ./build-deploy.sh --build-only              # Only build locally
    ./build-deploy.sh -t v1.2.3                 # Use specific tag
    ./build-deploy.sh -f values-prod.yaml       # Use custom values file
    ./build-deploy.sh --no-build --no-push      # Deploy only (use existing image)
EOF
}

# Get version from Chart.yaml
get_version() {
    if [ -f "helm/stackradar/Chart.yaml" ]; then
        grep '^version:' helm/stackradar/Chart.yaml | awk '{print $2}'
    else
        echo "0.0.0"
    fi
}

# Get git commit hash
get_commit() {
    if git rev-parse --git-dir > /dev/null 2>&1; then
        git rev-parse --short HEAD
    else
        echo "unknown"
    fi
}

# Get full git commit hash
get_commit_full() {
    if git rev-parse --git-dir > /dev/null 2>&1; then
        git rev-parse HEAD
    else
        echo "unknown"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--registry) REGISTRY="$2"; shift 2 ;;
        -t|--tag) TAG="$2"; shift 2 ;;
        -n|--namespace) HELM_NAMESPACE="$2"; shift 2 ;;
        -f|--values) HELM_VALUES="$2"; shift 2 ;;
        --no-build) DO_BUILD=false; shift ;;
        --no-push) DO_PUSH=false; shift ;;
        --no-deploy) DO_DEPLOY=false; shift ;;
        --build-only) DO_PUSH=false; DO_DEPLOY=false; shift ;;
        -h|--help) show_help; exit 0 ;;
        *) log_error "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

# Set version and commit
VERSION="${TAG:-$(get_version)}"
COMMIT=$(get_commit)
COMMIT_FULL=$(get_commit_full)

# Remove trailing slash from registry
REGISTRY="${REGISTRY%/}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

log_info "=========================================="
log_info "StackRadar Build & Deploy"
log_info "=========================================="
log_info "Version:    ${VERSION}"
log_info "Commit:     ${COMMIT}"
log_info "Image:      ${FULL_IMAGE}"
log_info "=========================================="

# Build
if [ "$DO_BUILD" = true ]; then
    log_info "Building Docker image..."

    docker build \
        --platform linux/amd64 \
        --build-arg BUILD_VERSION="${VERSION}" \
        --build-arg BUILD_COMMIT="${COMMIT_FULL}" \
        -t "${FULL_IMAGE}" \
        -t "${REGISTRY}/${IMAGE_NAME}:latest" \
        .

    log_success "Image built: ${FULL_IMAGE}"
else
    log_info "Skipping build"
fi

# Push
if [ "$DO_PUSH" = true ]; then
    log_info "Pushing image to registry..."

    docker push "${FULL_IMAGE}"
    docker push "${REGISTRY}/${IMAGE_NAME}:latest"

    log_success "Image pushed: ${FULL_IMAGE}"
else
    log_info "Skipping push"
fi

# Deploy
if [ "$DO_DEPLOY" = true ]; then
    if ! command -v helm &> /dev/null; then
        log_error "helm not found. Please install Helm."
        exit 1
    fi

    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    CONTEXT=$(kubectl config current-context)
    log_info "Target cluster: ${CONTEXT}"
    log_warning "Helm upgrade will be applied to namespace: ${HELM_NAMESPACE}"

    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cancelled"
        exit 0
    fi

    # Build helm command
    HELM_CMD="helm upgrade --install ${HELM_RELEASE} ./helm/stackradar"
    HELM_CMD="${HELM_CMD} --namespace ${HELM_NAMESPACE} --create-namespace"
    HELM_CMD="${HELM_CMD} --set image.repository=${REGISTRY}/${IMAGE_NAME}"
    HELM_CMD="${HELM_CMD} --set image.tag=${VERSION}"

    if [ -n "$HELM_VALUES" ]; then
        if [ ! -f "$HELM_VALUES" ]; then
            log_error "Values file not found: ${HELM_VALUES}"
            exit 1
        fi
        HELM_CMD="${HELM_CMD} -f ${HELM_VALUES}"
    fi

    log_info "Running Helm upgrade..."
    eval $HELM_CMD

    log_success "Deployment complete!"

    log_info "=========================================="
    log_info "Deployment Status:"
    kubectl get pods -n "${HELM_NAMESPACE}" -l app.kubernetes.io/name=stackradar

    echo ""
    log_info "Useful commands:"
    echo "  kubectl get pods -n ${HELM_NAMESPACE}"
    echo "  kubectl logs -n ${HELM_NAMESPACE} -l app.kubernetes.io/name=stackradar -f"
    echo "  helm status ${HELM_RELEASE} -n ${HELM_NAMESPACE}"
else
    log_info "Skipping deployment"
fi

log_success "Done!"
