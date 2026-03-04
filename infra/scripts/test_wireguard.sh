#!/usr/bin/env bash
# Phoenix v2 — Test WireGuard VPN connectivity across peers.
# Usage: ./test_wireguard.sh [CONFIG_PATH]
# Env: WG_CONFIG, PEER_IPS

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

WG_CONFIG="${WG_CONFIG:-/etc/wireguard/wg0.conf}"
PEER_IPS="${PEER_IPS:-}"  # Comma-separated: 10.0.0.2,10.0.0.3
[[ -n "${1:-}" ]] && WG_CONFIG="$1"

usage() {
  echo "Usage: $0 [CONFIG_PATH]"
  echo "  Tests WireGuard: interface, handshakes, ping peers."
  echo ""
  echo "Env: WG_CONFIG, PEER_IPS (comma-separated peer IPs to ping)"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

command -v wg &>/dev/null || { echo "Install WireGuard: apt install wireguard"; exit 1; }

echo "=== WireGuard Health Check ==="

# Interface up
IFACE=$(basename "$WG_CONFIG" .conf)
if ip link show "$IFACE" &>/dev/null; then
  ok "Interface $IFACE is up"
else
  fail "Interface $IFACE not found. Start: wg-quick up $IFACE"
  exit 1
fi

# Handshakes
ok "Peer handshakes:"
wg show "$IFACE" latest-handshakes | while read -r peer ts; do
  age=$(( $(date +%s) - ts ))
  if [[ $age -lt 180 ]]; then
    ok "  Peer $peer: handshake ${age}s ago"
  else
    fail "  Peer $peer: handshake ${age}s ago (stale)"
  fi
done

# Ping peers
if [[ -n "$PEER_IPS" ]]; then
  ok "Pinging peers..."
  for ip in ${PEER_IPS//,/ }; do
    if ping -c 1 -W 2 "$ip" &>/dev/null; then
      ok "  $ip: reachable"
    else
      fail "  $ip: unreachable"
    fi
  done
else
  warn "Set PEER_IPS to test connectivity (e.g. PEER_IPS=10.0.0.2,10.0.0.3)"
fi

ok "WireGuard check complete."
