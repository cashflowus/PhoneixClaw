#!/usr/bin/env bash
# selective-build.sh — Only build Docker services that have changed since last deploy.
#
# Usage:
#   ./scripts/selective-build.sh                  # detect changes, build only modified
#   ./scripts/selective-build.sh --all            # force build all services
#   ./scripts/selective-build.sh --list           # just list what would be built
#   ./scripts/selective-build.sh --since <commit> # compare against a specific commit
#
# The script uses git diff to detect which files changed and maps them to
# Docker Compose service names.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.coolify.yml}"
SINCE_COMMIT=""
MODE="build"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --all)   MODE="all"; shift ;;
        --list)  MODE="list"; shift ;;
        --since) SINCE_COMMIT="$2"; shift 2 ;;
        *)       echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ "$MODE" == "all" ]]; then
    echo "==> Building ALL services"
    DOCKER_BUILDKIT=1 docker compose -f "$COMPOSE_FILE" build
    exit 0
fi

if [[ -z "$SINCE_COMMIT" ]]; then
    SINCE_COMMIT=$(git log --format="%H" -n 2 | tail -1)
fi

echo "==> Comparing changes since $SINCE_COMMIT"
CHANGED_FILES=$(git diff --name-only "$SINCE_COMMIT" HEAD 2>/dev/null || git diff --name-only HEAD)

declare -A SERVICE_MAP=(
    ["services/auth-service"]="auth-service"
    ["services/api-gateway"]="api-gateway"
    ["services/trade-parser"]="trade-parser"
    ["services/trade-gateway"]="trade-gateway"
    ["services/trade-executor"]="trade-executor"
    ["services/position-monitor"]="position-monitor"
    ["services/notification-service"]="notification-service"
    ["services/source-orchestrator"]="source-orchestrator"
    ["services/audit-writer"]="audit-writer"
    ["services/discord-ingestor"]="source-orchestrator"
    ["services/nlp-parser"]="nlp-parser"
    ["services/dashboard-ui"]="dashboard-ui"
    ["services/signal-scorer"]="signal-scorer"
    ["services/reddit-ingestor"]="reddit-ingestor"
    ["services/twitter-ingestor"]="twitter-ingestor"
)

declare -A TO_BUILD=()
SHARED_CHANGED=false

while IFS= read -r file; do
    [[ -z "$file" ]] && continue

    if [[ "$file" == shared/* ]]; then
        SHARED_CHANGED=true
        continue
    fi

    if [[ "$file" == docker-compose* ]] || [[ "$file" == Dockerfile* ]]; then
        echo "  [compose/docker change] $file -> rebuild all"
        MODE="all"
        break
    fi

    for prefix in "${!SERVICE_MAP[@]}"; do
        if [[ "$file" == "$prefix"/* ]]; then
            svc="${SERVICE_MAP[$prefix]}"
            TO_BUILD[$svc]=1
            break
        fi
    done
done <<< "$CHANGED_FILES"

if [[ "$MODE" == "all" ]]; then
    echo "==> Building ALL services (compose file changed)"
    DOCKER_BUILDKIT=1 docker compose -f "$COMPOSE_FILE" build
    exit 0
fi

# shared/ changes affect all Python services (not nlp-parser or dashboard-ui which have
# their own build contexts)
if $SHARED_CHANGED; then
    echo "  [shared/ changed] Adding all Python services"
    for svc in auth-service api-gateway trade-parser trade-gateway trade-executor \
               position-monitor notification-service source-orchestrator audit-writer \
               signal-scorer reddit-ingestor twitter-ingestor; do
        TO_BUILD[$svc]=1
    done
    # Also rebuild init since it uses api-gateway Dockerfile
    TO_BUILD["init"]=1
fi

if [[ ${#TO_BUILD[@]} -eq 0 ]]; then
    echo "==> No service changes detected. Nothing to build."
    exit 0
fi

SERVICES="${!TO_BUILD[*]}"
echo "==> Services to build: $SERVICES"

if [[ "$MODE" == "list" ]]; then
    echo "  (--list mode, not building)"
    exit 0
fi

echo "==> Building with DOCKER_BUILDKIT=1"
DOCKER_BUILDKIT=1 docker compose -f "$COMPOSE_FILE" build $SERVICES

echo "==> Done. Built: $SERVICES"
