#!/bin/bash
#
# build-push.sh — Build and push all StackRadar Docker images
#
# Builds multi-arch (linux/amd64) images for the main app and all collectors,
# tags them with the given version and "latest", and pushes to the container registry.
#
# Images built:
#   <registry>/stackradar                        (main app)
#   <registry>/stackradar-logs-collector         (cluster log collector)
#   <registry>/stackradar-stats-collector        (cluster stats collector)
#   <registry>/stackradar-docker-logs-collector  (Docker log collector)
#   <registry>/stackradar-docker-stats-collector (Docker stats collector)
#
# Prerequisites:
#   - docker (with buildx for multi-platform builds)
#   - logged in to the registry (e.g. `docker login ghcr.io`)
#   - clean git working tree (use --force to skip this check)
#
# Usage:
#   ./scripts/build-push.sh -v <version> [options]
#
# Options:
#   -v, --version <version>    Version tag to apply (required), e.g. 1.2.0
#   -r, --registry <registry>  Container registry prefix (default: ghcr.io/gsotti)
#   -f, --force                Skip uncommitted changes check
#   -h, --help                 Show this help message
#
# Examples:
#   ./scripts/build-push.sh -v 1.2.0
#   ./scripts/build-push.sh -v 1.2.0 -r ghcr.io/myorg
#   ./scripts/build-push.sh -v 1.2.0 --force
#
set -e

FORCE=false
VERSION=""
REGISTRY="ghcr.io/gsotti"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help)
            sed -n '/^#/!q; s/^# \{0,1\}//p' "$0"
            exit 0
            ;;
        -f|--force) FORCE=true ;;
        -r|--registry)
            if [[ -n "$2" && "$2" != -* ]]; then
                REGISTRY=$2
                shift
            else
                echo "Error: Argument for $1 is missing"
                exit 1
            fi
            ;;
        -v|--version)
            if [[ -n "$2" && "$2" != -* ]]; then
                VERSION=$2
                shift
            else
                echo "Error: Argument for $1 is missing"
                exit 1
            fi
            ;;
        *)
            echo "Error: Unknown argument $1"
            echo "Usage: $0 -v|--version <version> [-r|--registry <registry>] [-f|--force]"
            exit 1
            ;;
    esac
    shift
done

if [ -z "$VERSION" ]; then
    echo "Error: Version is required"
    echo "Usage: $0 -v|--version <version> [-r|--registry <registry>] [-f|--force]"
    exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Check for uncommitted changes
if [ "$FORCE" = false ]; then
    if ! git -C "$ROOT_DIR" diff-index --quiet HEAD --; then
        echo "Error: You have uncommitted changes. Please commit or stash them (or use --force)"
        exit 1
    fi
fi

# Ensure version tag exists
TAG="v$VERSION-docker"
if ! git -C "$ROOT_DIR" rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Creating version tag: $TAG"
    git -C "$ROOT_DIR" tag -a "$TAG" -m "Release $VERSION"
else
    echo "Version tag $TAG already exists."
fi

COMMIT=$(git -C "$ROOT_DIR" rev-parse HEAD)

build_and_push() {
    local context=$1
    local image=$2

    echo ""
    echo "Building $image:$VERSION"
    docker build \
        --platform linux/amd64 \
        --build-arg BUILD_VERSION="$VERSION" \
        --build-arg BUILD_COMMIT="$COMMIT" \
        -t "$image:$VERSION" \
        -t "$image:latest" \
        "$context"

    echo "Pushing $image:$VERSION"
    docker push "$image:$VERSION"
    docker push "$image:latest"
}

# Main app
build_and_push "$ROOT_DIR"                            "$REGISTRY/stackradar"

# Collectors
build_and_push "$ROOT_DIR/collector-k8s/log-collector"   "$REGISTRY/stackradar-logs-collector"
build_and_push "$ROOT_DIR/collector-k8s/stats-collector"  "$REGISTRY/stackradar-stats-collector"
build_and_push "$ROOT_DIR/collector-docker/logs"          "$REGISTRY/stackradar-docker-logs-collector"
build_and_push "$ROOT_DIR/collector-docker/stats"         "$REGISTRY/stackradar-docker-stats-collector"

echo ""
echo "All images built and pushed at version $VERSION (registry: $REGISTRY)"
