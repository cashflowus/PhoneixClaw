#!/usr/bin/env bash
# Phoenix v2 — Backup PostgreSQL to MinIO phoenix-backups bucket.
# Usage: ./db-backup.sh
# Env: PG_HOST, PG_USER, PG_DATABASE, MC_ALIAS, RETENTION_DAYS

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-phoenixtrader}"
PG_DATABASE="${PG_DATABASE:-phoenixtrader}"
MC_ALIAS="${MC_ALIAS:-phoenix}"
BUCKET="${BUCKET:-phoenix-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/phoenix-backups}"

usage() {
  echo "Usage: $0"
  echo "  pg_dump -> gzip -> upload to MinIO, retain $RETENTION_DAYS days"
  echo ""
  echo "Env: PG_HOST, PG_USER, PG_DATABASE, MC_ALIAS, RETENTION_DAYS"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/phoenix_${TS}.sql.gz"

ok "Backing up $PG_DATABASE to $FILE..."
export PGPASSWORD="${PGPASSWORD:-}"
pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" --no-owner --no-acl 2>/dev/null | gzip -9 > "$FILE" || fail "pg_dump failed (set PGPASSWORD if needed)"

ok "Uploading to MinIO $BUCKET..."
mc cp "$FILE" "$MC_ALIAS/$BUCKET/$(basename "$FILE")" 2>/dev/null || fail "mc upload failed"

ok "Removing local backup..."
rm -f "$FILE"

ok "Pruning backups older than $RETENTION_DAYS days..."
mc find "$MC_ALIAS/$BUCKET" --older-than "${RETENTION_DAYS}d" --exec "mc rm {}" 2>/dev/null || true

ok "Backup complete: phoenix_${TS}.sql.gz"
