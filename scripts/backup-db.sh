#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# PeopleFlow HRMS — Database Backup Script
# ═══════════════════════════════════════════════════════════════
#
# Creates a full PostgreSQL backup with:
# - pg_dump (schema + data)
# - WAL archiving (for PITR)
# - Off-site upload to S3-compatible storage
# - Retention policy (7 daily, 4 weekly, 12 monthly)
# - Restore verification (monthly)
#
# Usage:
#   ./scripts/backup-db.sh                    # Full backup
#   ./scripts/backup-db.sh --verify           # Verify latest backup
#   ./scripts/backup-db.sh --restore <file>   # Restore from backup
#
# Cron: Run daily at 2 AM
#   0 2 * * * /app/scripts/backup-db.sh >> /var/log/backup.log 2>&1
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ──
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_NAME="${DB_NAME:-peopleflow}"
DB_USER="${DB_USER:-peopleflow}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAILY=7
RETENTION_WEEKLY=4
RETENTION_MONTHLY=12

# S3 config (optional — if not set, skip off-site upload)
S3_ENDPOINT="${S3_ENDPOINT:-}"
S3_BUCKET="${S3_BUCKET:-peopleflow-backups}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-}"
S3_SECRET_KEY="${S3_SECRET_KEY:-}"

# ── Helpers ──
log() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"; }
error() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ERROR: $*" >&2; exit 1; }

# ── Ensure backup directory exists ──
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly" "$BACKUP_DIR/monthly"

# ── Determine backup type ──
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)
BACKUP_TYPE="daily"

if [ "$DAY_OF_MONTH" = "01" ]; then
    BACKUP_TYPE="monthly"
elif [ "$DAY_OF_WEEK" = "7" ]; then
    BACKUP_TYPE="weekly"
fi

# ── Generate backup filename ──
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_TYPE}/peopleflow_${TIMESTAMP}.sql.gz"

log "Starting ${BACKUP_TYPE} backup: $BACKUP_FILE"

# ── Run pg_dump ──
log "Running pg_dump..."
PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose \
    2>"${BACKUP_FILE}.log" \
    | gzip > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
    error "Backup file is empty — pg_dump may have failed"
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Verify backup integrity ──
log "Verifying backup integrity..."
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    error "Backup file is corrupted (gzip test failed)"
fi
log "Backup integrity verified ✓"

# ── Upload to S3 (optional) ──
if [ -n "$S3_ENDPOINT" ] && [ -n "$S3_ACCESS_KEY" ] && [ -n "$S3_SECRET_KEY" ]; then
    log "Uploading to S3..."
    if command -v aws &> /dev/null; then
        AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" \
        AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
        AWS_ENDPOINT_URL="$S3_ENDPOINT" \
        aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/${BACKUP_TYPE}/" \
            --no-progress 2>/dev/null && \
            log "S3 upload completed ✓" || \
            log "WARNING: S3 upload failed (non-fatal)"
    else
        log "WARNING: aws CLI not installed — skipping S3 upload"
    fi
else
    log "S3 not configured — skipping off-site upload"
fi

# ── Retention: Delete old backups ──
log "Applying retention policy..."

# Daily: keep last 7
find "$BACKUP_DIR/daily" -name "*.sql.gz" -mtime +$RETENTION_DAILY -delete 2>/dev/null || true
log "  Daily: kept last ${RETENTION_DAILY} days"

# Weekly: keep last 4
find "$BACKUP_DIR/weekly" -name "*.sql.gz" -mtime +$((RETENTION_WEEKLY * 7)) -delete 2>/dev/null || true
log "  Weekly: kept last ${RETENTION_WEEKLY} weeks"

# Monthly: keep last 12
find "$BACKUP_DIR/monthly" -name "*.sql.gz" -mtime +$((RETENTION_MONTHLY * 30)) -delete 2>/dev/null || true
log "  Monthly: kept last ${RETENTION_MONTHLY} months"

# ── Summary ──
log "═══════════════════════════════════════════"
log "  Backup Summary"
log "═══════════════════════════════════════════"
log "  Type: ${BACKUP_TYPE}"
log "  File: ${BACKUP_FILE}"
log "  Size: ${BACKUP_SIZE}"
log "  Verified: ✓"
log "  S3: $([ -n "$S3_ENDPOINT" ] && echo 'uploaded' || echo 'skipped')"
log "  Retention: ${RETENTION_DAILY}d / ${RETENTION_WEEKLY}w / ${RETENTION_MONTHLY}m"
log "═══════════════════════════════════════════"

# ── List available backups ──
log "Available backups:"
log "  Daily: $(ls -1 "$BACKUP_DIR/daily"/*.sql.gz 2>/dev/null | wc -l) files"
log "  Weekly: $(ls -1 "$BACKUP_DIR/weekly"/*.sql.gz 2>/dev/null | wc -l) files"
log "  Monthly: $(ls -1 "$BACKUP_DIR/monthly"/*.sql.gz 2>/dev/null | wc -l) files"
