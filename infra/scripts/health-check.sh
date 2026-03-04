#!/usr/bin/env bash
# Phoenix v2 — Health check all services (API, bridge, Redis, PostgreSQL, MinIO).
# Usage: ./health-check.sh
# Env: API_URL, BRIDGE_URL, REDIS_URL, PG_HOST, MINIO_ENDPOINT

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

API_URL="${API_URL:-http://localhost:8011}"
BRIDGE_URL="${BRIDGE_URL:-http://localhost:18800}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
FAILED=0

usage() {
  echo "Usage: $0"
  echo "  Checks API, bridge, Redis, PostgreSQL, MinIO."
  echo ""
  echo "Env: API_URL, BRIDGE_URL, REDIS_HOST, PG_HOST, MINIO_ENDPOINT"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

echo "=== Phoenix Health Check ==="

# API
if curl -sf --connect-timeout 3 "$API_URL/health" >/dev/null; then
  ok "API ($API_URL)"
else
  fail "API ($API_URL)"; ((FAILED++))
fi

# Bridge
if curl -sf --connect-timeout 3 "$BRIDGE_URL/health" >/dev/null 2>/dev/null || curl -sf --connect-timeout 3 "$BRIDGE_URL/" >/dev/null; then
  ok "Bridge ($BRIDGE_URL)"
else
  fail "Bridge ($BRIDGE_URL)"; ((FAILED++))
fi

# Redis
if command -v redis-cli &>/dev/null; then
  redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG && ok "Redis ($REDIS_HOST:$REDIS_PORT)" || { fail "Redis"; ((FAILED++)); }
else
  warn "redis-cli not installed, skipping Redis check"
fi

# PostgreSQL
if command -v pg_isready &>/dev/null; then
  pg_isready -h "$PG_HOST" -p "$PG_PORT" -q 2>/dev/null && ok "PostgreSQL ($PG_HOST:$PG_PORT)" || { fail "PostgreSQL"; ((FAILED++)); }
else
  warn "pg_isready not installed, skipping PostgreSQL check"
fi

# MinIO
if curl -sf --connect-timeout 3 "$MINIO_ENDPOINT/minio/health/live" >/dev/null 2>/dev/null; then
  ok "MinIO ($MINIO_ENDPOINT)"
else
  fail "MinIO ($MINIO_ENDPOINT)"; ((FAILED++))
fi

echo ""
[[ $FAILED -eq 0 ]] && { ok "All services healthy."; exit 0; } || { fail "$FAILED service(s) down."; exit 1; }
