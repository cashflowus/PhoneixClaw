#!/usr/bin/env bash
# Phoenix v2 — Install Coolify on a fresh VPS for self-hosted deployment.
# Usage: ./provision-coolify.sh [--skip-firewall]
# Requires: root or sudo

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

SKIP_FIREWALL="${SKIP_FIREWALL:-false}"
[[ "${1:-}" == "--skip-firewall" ]] && SKIP_FIREWALL=true

usage() {
  echo "Usage: $0 [--skip-firewall]"
  echo "  --skip-firewall  Skip UFW firewall configuration"
  echo ""
  echo "Env: SKIP_FIREWALL=true to skip firewall"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root or with sudo"; exit 1; }

ok "Updating apt..."
apt-get update -qq

ok "Installing Docker..."
apt-get install -y -qq ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture)] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -qq && apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

ok "Installing Coolify CLI..."
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

if [[ "$SKIP_FIREWALL" != "true" ]]; then
  ok "Configuring UFW firewall..."
  apt-get install -y -qq ufw
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  warn "UFW enabled. Ensure SSH (22) access before disconnecting."
else
  warn "Skipping firewall (--skip-firewall)"
fi

ok "Coolify provisioned. Run 'coolify' to start the installer."
