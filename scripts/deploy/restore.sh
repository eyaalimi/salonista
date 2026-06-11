#!/usr/bin/env bash
# restore.sh — restore salonista_prod from a pg_dump custom-format file.
# WARNING: this DROPS and recreates schema objects.
# Usage: bash scripts/deploy/restore.sh /path/to/dump
# Confirmation: type 'restore' when prompted.
# Does NOT restore uploads/. Run `tar xzf` manually after spot-checking the DB.

set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Usage: $0 <dump-path>"
  exit 1
fi

APP_DIR="${APP_DIR:-/home/ubuntu/salonista}"
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: $APP_DIR/.env not found"
  exit 1
fi
# shellcheck disable=SC1091
set +u; source "$APP_DIR/.env"; set -u
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

PG_URI="${DATABASE_URL%%\?*}"
PG_CREDS_HOST="${PG_URI#postgresql://}"
PG_USERPASS="${PG_CREDS_HOST%@*}"
PG_HOSTDB="${PG_CREDS_HOST#*@}"
export PGUSER="${PG_USERPASS%%:*}"
export PGPASSWORD="${PG_USERPASS#*:}"
PG_HOSTPORT="${PG_HOSTDB%%/*}"
export PGHOST="${PG_HOSTPORT%%:*}"
export PGPORT="${PG_HOSTPORT##*:}"
export PGDATABASE="${PG_HOSTDB#*/}"

echo "About to restore $DUMP into database '$PGDATABASE' on $PGHOST."
echo "This will DROP existing objects (pg_restore --clean --if-exists)."
read -r -p "Type 'restore' to continue: " confirm
if [ "$confirm" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-acl -d "$PGDATABASE" "$DUMP"
echo "Restore complete."
