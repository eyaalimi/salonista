#!/usr/bin/env bash
# backup.sh — nightly backup of salonista_prod + public/uploads/
# Cron: 30 3 * * * ubuntu cd /home/ubuntu/salonista && bash scripts/deploy/backup.sh
# Exits non-zero only on actual backup failure. Missing S3 config = warn + continue.

set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/salonista}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/ubuntu/backups}"
DB_DIR="$BACKUP_ROOT/db"
UP_DIR="$BACKUP_ROOT/uploads"
LOG_FILE="$BACKUP_ROOT/backup.log"
TIMESTAMP="$(date -u +%Y-%m-%d_%H%M)"

mkdir -p "$DB_DIR" "$UP_DIR"

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG_FILE"; }

# --- Phase 1: parse DATABASE_URL ---
if [ ! -f "$APP_DIR/.env" ]; then
  log "ERROR: $APP_DIR/.env not found"
  exit 1
fi
# shellcheck disable=SC1091
set +u; source "$APP_DIR/.env"; set -u
if [ -z "${DATABASE_URL:-}" ]; then
  log "ERROR: DATABASE_URL not set"
  exit 1
fi
# Expected form: postgresql://user:pass@host:port/dbname?...
PG_URI="${DATABASE_URL%%\?*}"   # strip query
PG_CREDS_HOST="${PG_URI#postgresql://}"
PG_USERPASS="${PG_CREDS_HOST%@*}"
PG_HOSTDB="${PG_CREDS_HOST#*@}"
export PGUSER="${PG_USERPASS%%:*}"
export PGPASSWORD="${PG_USERPASS#*:}"
PG_HOSTPORT="${PG_HOSTDB%%/*}"
export PGHOST="${PG_HOSTPORT%%:*}"
export PGPORT="${PG_HOSTPORT##*:}"
export PGDATABASE="${PG_HOSTDB#*/}"

# --- Phase 2: pg_dump ---
DUMP_PATH="$DB_DIR/salonista_${TIMESTAMP}.dump"
log "pg_dump → $DUMP_PATH"
if ! pg_dump -Fc -f "$DUMP_PATH" 2>>"$LOG_FILE"; then
  log "ERROR: pg_dump failed"
  rm -f "$DUMP_PATH"
  exit 1
fi
# Verify by listing
if ! pg_restore --list "$DUMP_PATH" >/dev/null 2>>"$LOG_FILE"; then
  log "ERROR: pg_restore --list failed on $DUMP_PATH; deleting partial dump"
  rm -f "$DUMP_PATH"
  exit 1
fi
log "pg_dump OK ($(stat -c%s "$DUMP_PATH") bytes)"

# --- Phase 3: uploads tar.gz ---
UP_PATH="$UP_DIR/uploads_${TIMESTAMP}.tar.gz"
log "tar uploads → $UP_PATH"
if ! tar -czf "$UP_PATH" -C "$APP_DIR/public" uploads 2>>"$LOG_FILE"; then
  log "ERROR: tar failed"
  rm -f "$UP_PATH"
  exit 1
fi
log "uploads archive OK ($(stat -c%s "$UP_PATH") bytes)"

# --- Phase 4: retention prune ---
# Keep last 14 daily backups + last 8 Sunday backups (per directory).
prune_dir() {
  local dir="$1"
  while IFS= read -r f; do
    dow=$(date -u -d "@$(stat -c%Y "$f")" +%u)  # 7 = Sunday
    age_days=$(( ( $(date -u +%s) - $(stat -c%Y "$f") ) / 86400 ))
    if [ "$dow" = "7" ] && [ "$age_days" -le 56 ]; then
      continue
    fi
    log "prune $f (age ${age_days}d, dow ${dow})"
    rm -f "$f"
  done < <(find "$dir" -type f -mtime +14)
}
prune_dir "$DB_DIR"
prune_dir "$UP_DIR"

# --- Phase 5: optional S3 sync ---
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    log "WARN: BACKUP_S3_BUCKET set but aws CLI missing; skipping offsite"
    touch "$BACKUP_ROOT/.last-s3-error"
  else
    log "aws s3 sync → s3://$BACKUP_S3_BUCKET/$(hostname)/"
    if aws s3 sync "$BACKUP_ROOT/" "s3://$BACKUP_S3_BUCKET/$(hostname)/" \
         --delete --exclude "*.log" --exclude ".last-*" 2>>"$LOG_FILE"; then
      log "s3 sync OK"
      rm -f "$BACKUP_ROOT/.last-s3-error"
    else
      log "WARN: s3 sync failed (see log); continuing"
      touch "$BACKUP_ROOT/.last-s3-error"
    fi
  fi
fi

# --- Phase 6: success touchfile ---
echo "$DUMP_PATH" > "$BACKUP_ROOT/.last-backup"
log "backup complete"
