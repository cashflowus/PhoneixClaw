#!/usr/bin/env bash
# Phoenix v2 — Sync skills from MinIO phoenix-skills bucket to local OpenClaw.
# Usage: ./sync-skills.sh
# Env: MC_ALIAS, MINIO_ENDPOINT, SKILLS_DEST

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

MC_ALIAS="${MC_ALIAS:-phoenix}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
SKILLS_DEST="${SKILLS_DEST:-/opt/phoenix/skills}"
BUCKET="${BUCKET:-phoenix-skills}"

usage() {
  echo "Usage: $0"
  echo "  Syncs skills from MinIO $BUCKET to $SKILLS_DEST"
  echo ""
  echo "Env: MC_ALIAS, MINIO_ENDPOINT, SKILLS_DEST, BUCKET"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

command -v mc &>/dev/null || fail "Install mc (MinIO client): https://min.io/docs/minio/linux/reference/minio-mc.html"

ok "Configuring mc alias..."
mc alias set "$MC_ALIAS" "$MINIO_ENDPOINT" "${MINIO_ROOT_USER:-minioadmin}" "${MINIO_ROOT_PASSWORD:-minioadmin}" 2>/dev/null || true

ok "Creating destination $SKILLS_DEST..."
mkdir -p "$SKILLS_DEST"

ok "Mirroring $BUCKET -> $SKILLS_DEST..."
if mc ls "$MC_ALIAS/$BUCKET" &>/dev/null; then
  mc mirror "$MC_ALIAS/$BUCKET" "$SKILLS_DEST" --overwrite --remove
  ok "Skills synced."
else
  warn "Bucket $BUCKET empty or missing. Run init-minio.sh first."
fi
