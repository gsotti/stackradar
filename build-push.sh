#!/bin/bash

# StackRadar Build and Push Script
set -e

FORCE=false
VERSION=""

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -v, --version <version> The version to build and push"
            echo "  -i, --image <image>     Override the default image name"
            echo "  -f, --force             Force build even if there are uncommitted changes"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --version 1.0.0"
            echo "  $0 -v 1.0.0 --image my-registry.com/my-image"
            echo "  $0 -v 1.0.0 --force"
            exit 0
            ;;
        -f|--force) FORCE=true ;;
        -i|--image)
            if [[ -n "$2" && "$2" != -* ]]; then
                IMAGE_OVERRIDE=$2
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
            echo "Usage: $0 -v|--version <version> [-i|--image <image>] [-f|--force]"
            exit 1
            ;;
    esac
    shift
done

if [ -z "$VERSION" ]; then
    echo "Error: Version is required"
    echo "Usage: $0 -v|--version <version> [-i|--image <image>] [-f|--force]"
    exit 1
fi

# Check for uncommitted changes
if [ "$FORCE" = false ]; then
    if ! git diff-index --quiet HEAD --; then
        echo "Error: You have uncommitted changes. Please commit or stash them"
        exit 1
    fi
fi

# Ensure version tag exists
TAG="v$VERSION-docker"
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Creating version tag: $TAG"
    git tag -a "$TAG" -m "Release $VERSION"
else
    echo "Version tag $TAG already exists."
fi

COMMIT=$(git rev-parse HEAD)
IMAGE=${IMAGE_OVERRIDE:-"ghcr.io/gsotti/stackradar"}

echo "Building Docker image: $IMAGE:$VERSION"
docker build \
    --platform linux/amd64 \
    --build-arg BUILD_VERSION="$VERSION" \
    --build-arg BUILD_COMMIT="$COMMIT" \
    -t "$IMAGE:$VERSION" \
    -t "$IMAGE:latest" .

echo "Pushing Docker image: $IMAGE:$VERSION"
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:latest"

echo "Done!"
