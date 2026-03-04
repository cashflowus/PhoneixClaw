#!/usr/bin/env bash
# Phoenix v2 — Seed database with default admin user, roles, permissions.
# Usage: ./seed-db.sh
# Env: PG_HOST, PG_USER, PG_DATABASE, ADMIN_EMAIL, ADMIN_PASSWORD

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
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@phoenix.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"

usage() {
  echo "Usage: $0"
  echo "  Seeds users, roles, permissions. Set ADMIN_EMAIL and ADMIN_PASSWORD."
  echo ""
  echo "Env: PG_HOST, PG_USER, PG_DATABASE, ADMIN_EMAIL, ADMIN_PASSWORD"
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

ok "Seeding database $PG_DATABASE..."
export PGPASSWORD="${PGPASSWORD:-}"
ADMIN_EMAIL_SQL=$(printf '%s' "$ADMIN_EMAIL" | sed "s/'/''/g")
ADMIN_PASSWORD_SQL=$(printf '%s' "$ADMIN_PASSWORD" | sed "s/'/''/g")

psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" -v ON_ERROR_STOP=1 <<EOSQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO users (id, email, hashed_password, name, role, is_admin, is_active, permissions)
SELECT gen_random_uuid(), '$ADMIN_EMAIL_SQL', crypt('$ADMIN_PASSWORD_SQL', gen_salt('bf')), 'Admin', 'admin', true, true, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = '$ADMIN_EMAIL_SQL');
EOSQL

ok "Seed complete. Admin: $ADMIN_EMAIL"
