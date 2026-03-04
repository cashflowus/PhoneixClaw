#!/usr/bin/env bash
# Phoenix v2 — Deploy OpenClaw instance on a VPS node.
# Usage: ./deploy-openclaw.sh [REPO_URL] [INSTANCE_ID]
# Env: PHOENIX_REPO, INSTANCE_ID, PHOENIX_ROOT

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

PHOENIX_REPO="${PHOENIX_REPO:-https://github.com/your-org/ProjectPhoenix.git}"
INSTANCE_ID="${INSTANCE_ID:-openclaw-1}"
PHOENIX_ROOT="${PHOENIX_ROOT:-/opt/phoenix}"

usage() {
  echo "Usage: $0 [REPO_URL] [INSTANCE_ID]"
  echo "  Deploys OpenClaw: clone, build bridge, start systemd services."
  echo ""
  echo "Env: PHOENIX_REPO, INSTANCE_ID, PHOENIX_ROOT"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage
[[ -n "${1:-}" ]] && PHOENIX_REPO="$1"
[[ -n "${2:-}" ]] && INSTANCE_ID="$2"

ok "Creating directory $PHOENIX_ROOT..."
mkdir -p "$PHOENIX_ROOT"
cd "$PHOENIX_ROOT"

if [[ -d "ProjectPhoenix" ]]; then
  ok "Pulling latest..."
  cd ProjectPhoenix && git pull --rebase
else
  ok "Cloning $PHOENIX_REPO..."
  git clone "$PHOENIX_REPO" ProjectPhoenix
  cd ProjectPhoenix
fi

ok "Building phoenix-bridge..."
docker compose -f infra/docker-compose.production.yml build phoenix-bridge --quiet

ok "Starting systemd services..."
systemctl daemon-reload
systemctl enable phoenix-bridge phoenix-api 2>/dev/null || true
systemctl restart phoenix-bridge phoenix-api 2>/dev/null || systemctl start phoenix-bridge phoenix-api 2>/dev/null || warn "systemd units may not exist; start manually"

ok "Verifying health..."
sleep 5
curl -sf "http://localhost:8011/health" >/dev/null && ok "API healthy" || warn "API not responding"
curl -sf "http://localhost:18800/health" >/dev/null 2>/dev/null && ok "Bridge healthy" || warn "Bridge health endpoint not found"

ok "OpenClaw instance $INSTANCE_ID deployed."
