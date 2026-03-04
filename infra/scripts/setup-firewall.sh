#!/usr/bin/env bash
# Phoenix v2 — Configure UFW firewall for production VPS.
# Usage: ./setup-firewall.sh [--dry-run]
# Allows: 22 (SSH), 80 (HTTP), 443 (HTTPS), 51820/udp (WireGuard)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

usage() {
  echo "Usage: $0 [--dry-run]"
  echo "  Configures UFW: allow 22, 80, 443, 51820/udp; default deny."
  echo ""
  echo "  --dry-run  Print rules without applying"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root or with sudo"; exit 1; }

command -v ufw &>/dev/null || fail "UFW not installed. apt install ufw"

ok "Configuring firewall rules..."

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Would add: allow 22/tcp, 80/tcp, 443/tcp, 51820/udp; default deny incoming"
  exit 0
fi

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw allow 51820/udp comment 'WireGuard'

ufw --force enable
ok "Firewall enabled. Ensure SSH (22) is accessible before disconnecting."
