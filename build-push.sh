#!/bin/bash

# StackRadar Build and Push Script
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    exit 1
fi

VERSION=$1
COMMIT=$(git rev-parse HEAD)
IMAGE="ghcr.io/gsotti/stackradar"

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
