#!/bin/bash
#
# publish-helm.sh — Package and push all StackRadar Helm charts to the OCI registry
#
# Charts published:
#   stackradar                      (main app)
#   stackradar-logs-collector   (Kubernetes pod log collector)
#   stackradar-stats-collector  (Kubernetes stats collector)
#
# Each chart is versioned independently via its own Chart.yaml.
#
# Prerequisites:
#   - helm >= 3.8
#   - logged in to the registry (e.g. `helm registry login ghcr.io`)
#
# Usage:
#   ./scripts/publish-helm.sh [-r <registry>]
#
# Options:
#   -r, --registry <registry>  OCI registry prefix (default: oci://ghcr.io/gsotti/charts)
#   -h, --help                 Show this help message
#
# Examples:
#   ./scripts/publish-helm.sh
#   ./scripts/publish-helm.sh -r oci://ghcr.io/myorg/charts
#
set -e

REGISTRY="oci://ghcr.io/gsotti/charts"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help)
            sed -n '/^#/!q; s/^# \{0,1\}//p' "$0"
            exit 0
            ;;
        -r|--registry)
            if [[ -n "$2" && "$2" != -* ]]; then
                REGISTRY=$2
                shift
            else
                echo "Error: Argument for $1 is missing"
                exit 1
            fi
            ;;
        *)
            echo "Error: Unknown argument $1"
            echo "Usage: $0 [-r|--registry <registry>]"
            exit 1
            ;;
    esac
    shift
done

HELM_DIR="$(cd "$(dirname "$0")/../helm" && pwd)"
TMP_DIR="$(mktemp -d)"
trap "rm -rf $TMP_DIR" EXIT

publish_chart() {
    local chart_dir=$1
    local name
    name=$(basename "$chart_dir")
    local version
    version=$(grep '^version:' "$chart_dir/Chart.yaml" | awk '{print $2}')

    echo ""
    echo "Packaging $name v$version..."
    helm package "$chart_dir" --destination "$TMP_DIR"

    echo "Pushing to $REGISTRY..."
    helm push "$TMP_DIR/$name-$version.tgz" "$REGISTRY"

    echo "Done: ${REGISTRY#oci://}/$name:$version"
}

publish_chart "$HELM_DIR/stackradar"
publish_chart "$HELM_DIR/stackradar-logs-collector"
publish_chart "$HELM_DIR/stackradar-stats-collector"

echo ""
echo "All charts published to $REGISTRY"
