#!/usr/bin/env bash
# Phoenix v2 — Remove a local node from the Phoenix network.
# Usage: ./deprovision-local-node.sh [--force]
# Env: CONTROL_PLANE_URL, NODE_NAME, WG_CONFIG_PATH, PHOENIX_ROOT

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-https://api.phoenix.example.com}"
NODE_NAME="${NODE_NAME:-local-laptop-$(hostname)}"
WG_CONFIG_PATH="${WG_CONFIG_PATH:-/etc/wireguard/wg0.conf}"
PHOENIX_ROOT="${PHOENIX_ROOT:-/opt/phoenix}"
FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

usage() {
  echo "Usage: $0 [--force]"
  echo "  Deregisters node, stops services, removes WireGuard, cleans Docker."
  echo ""
  echo "Env: CONTROL_PLANE_URL, NODE_NAME, WG_CONFIG_PATH, PHOENIX_ROOT"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

if [[ "$FORCE" != "true" ]]; then
  read -r -p "Deprovision node $NODE_NAME? [y/N] " r
  [[ "${r:-}" != "y" && "${r:-}" != "Y" ]] && { echo "Aborted."; exit 0; }
fi

# Deregister from control plane
ok "Deregistering from $CONTROL_PLANE_URL..."
curl -sf -X DELETE "$CONTROL_PLANE_URL/api/v1/nodes/$NODE_NAME" 2>/dev/null && ok "Deregistered" || warn "Deregistration failed (may already be removed)"

# Stop Phoenix services
ok "Stopping Phoenix services..."
systemctl stop phoenix-bridge phoenix-api 2>/dev/null || true
docker compose -f "$PHOENIX_ROOT/ProjectPhoenix/infra/docker-compose.production.yml" down 2>/dev/null || true

# Stop WireGuard
IFACE=$(basename "$WG_CONFIG_PATH" .conf)
if command -v wg-quick &>/dev/null; then
  if wg show "$IFACE" &>/dev/null 2>/dev/null || ip link show "$IFACE" &>/dev/null 2>/dev/null; then
    ok "Stopping WireGuard $IFACE..."
    sudo wg-quick down "$IFACE" 2>/dev/null || true
  fi
fi
[[ -f "$WG_CONFIG_PATH" ]] && { sudo rm -f "$WG_CONFIG_PATH"; ok "Removed WireGuard config"; }

# Clean Docker
ok "Cleaning Phoenix Docker resources..."
for id in $(docker ps -a --filter "name=phoenix" -q 2>/dev/null); do docker rm -f "$id" 2>/dev/null; done
for id in $(docker images --filter "reference=*phoenix*" -q 2>/dev/null); do docker rmi -f "$id" 2>/dev/null; done

ok "Local node deprovisioned."
