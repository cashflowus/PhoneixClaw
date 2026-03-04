#!/usr/bin/env bash
# Phoenix v2 — Provision a local laptop as an OpenClaw node.
# Usage: ./provision-local-node.sh [CONTROL_PLANE_URL]
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
[[ -n "${1:-}" ]] && CONTROL_PLANE_URL="$1"

usage() {
  echo "Usage: $0 [CONTROL_PLANE_URL]"
  echo "  Provisions: Docker, WireGuard, control-plane registration, caffeinate."
  echo ""
  echo "Env: CONTROL_PLANE_URL, NODE_NAME, WG_CONFIG_PATH, PHOENIX_ROOT"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

# Docker
if ! command -v docker &>/dev/null; then
  ok "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  [[ "$(uname)" == "Darwin" ]] && open -a Docker
else
  ok "Docker already installed"
fi

# WireGuard
if ! command -v wg &>/dev/null; then
  if [[ "$(uname)" == "Darwin" ]]; then
    warn "Install WireGuard from App Store or: brew install wireguard-tools"
  else
    sudo apt-get update && sudo apt-get install -y wireguard
  fi
else
  ok "WireGuard already installed"
fi

# Register with control plane
ok "Registering node $NODE_NAME with $CONTROL_PLANE_URL..."
curl -sf -X POST "$CONTROL_PLANE_URL/api/v1/nodes/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NODE_NAME\",\"node_type\":\"laptop\"}" 2>/dev/null && ok "Registered" || warn "Registration failed (control plane may be down)"

# WireGuard auto-start
if [[ -f "$WG_CONFIG_PATH" ]]; then
  ok "Enabling WireGuard auto-start..."
  [[ "$(uname)" == "Darwin" ]] && sudo launchctl load /Library/LaunchDaemons/com.wireguard.wg0.plist 2>/dev/null || true
  [[ "$(uname)" == "Linux" ]] && sudo systemctl enable wg-quick@wg0 2>/dev/null || true
else
  warn "WireGuard config not found at $WG_CONFIG_PATH. Add config and start manually."
fi

# Prevent sleep (macOS)
if [[ "$(uname)" == "Darwin" ]]; then
  ok "Use 'caffeinate -s' to prevent sleep while node is active"
fi

ok "Local node provisioned: $NODE_NAME"
