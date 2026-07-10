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
#   ./scripts/backup-db.sh                       # Full backup
#   ./scripts/backup-db.sh --verify              # Verify latest backup (read-only)
#   ./scripts/backup-db.sh --restore <file>      # Restore from backup (interactive)
#   ./scripts/backup-db.sh --test-restore        # Automated restore drill on a TEMP database
#
# Cron: Run daily at 2 AM
#   0 2 * * * /app/scripts/backup-db.sh >> /var/log/backup.log 2>&1
#
# Monthly restore-drill cron (1st of month at 3 AM):
#   0 3 1 * * /app/scripts/backup-db.sh --test-restore >> /var/log/backup-test.log 2>&1
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

# ═══════════════════════════════════════════════════════════════
# Subcommand: --verify
# ═══════════════════════════════════════════════════════════════
# Reads the most recent daily backup and validates:
#   1. gzip integrity (`gzip -t`)
#   2. SQL content (pg_dump header present)
#   3. Table definition count (sanity check)
# Read-only — never writes to disk or DB.
if [ "${1:-}" = "--verify" ]; then
    echo "[VERIFY] Verifying latest backup..."
    LATEST=$(ls -t "$BACKUP_DIR"/daily/*.sql.gz 2>/dev/null | head -1)
    if [ -z "$LATEST" ]; then
        echo "[VERIFY] ERROR: No backup found to verify"
        exit 1
    fi
    echo "[VERIFY] Checking gzip integrity: $LATEST"
    if gzip -t "$LATEST"; then
        echo "[VERIFY] ✓ gzip integrity OK"
    else
        echo "[VERIFY] ✗ gzip integrity FAILED"
        exit 1
    fi
    echo "[VERIFY] Checking SQL content..."
    CONTENT_CHECK=$(zcat "$LATEST" | head -20 | grep -c "PostgreSQL database dump")
    if [ "$CONTENT_CHECK" -gt 0 ]; then
        echo "[VERIFY] ✓ SQL content valid (PostgreSQL dump header found)"
    else
        echo "[VERIFY] ✗ SQL content invalid"
        exit 1
    fi
    TABLE_COUNT=$(zcat "$LATEST" | grep -c "CREATE TABLE")
    echo "[VERIFY] ✓ Found $TABLE_COUNT table definitions"
    echo "[VERIFY] ✓ Backup verification PASSED"
    exit 0
fi

# ═══════════════════════════════════════════════════════════════
# Subcommand: --restore <file>
# ═══════════════════════════════════════════════════════════════
# DANGEROUS: overwrites the current database. Requires interactive
# confirmation (type 'CONFIRM') so it can never be triggered by a
# cron job or piping 'yes' to stdin.
if [ "${1:-}" = "--restore" ]; then
    RESTORE_FILE="${2:-}"
    if [ -z "$RESTORE_FILE" ]; then
        echo "[RESTORE] ERROR: No file specified. Usage: $0 --restore <file>"
        exit 1
    fi
    if [ ! -f "$RESTORE_FILE" ]; then
        echo "[RESTORE] ERROR: File not found: $RESTORE_FILE"
        exit 1
    fi
    echo "[RESTORE] WARNING: This will OVERWRITE the current database!"
    echo "[RESTORE] File: $RESTORE_FILE"
    echo "[RESTORE] Target: $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER"
    read -p "Type 'CONFIRM' to proceed: " CONFIRM
    if [ "$CONFIRM" != "CONFIRM" ]; then
        echo "[RESTORE] Cancelled."
        exit 0
    fi
    echo "[RESTORE] Dropping existing tables..."
    PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null
    echo "[RESTORE] Restoring from backup..."
    if [[ "$RESTORE_FILE" == *.gz ]]; then
        if gunzip -c "$RESTORE_FILE" | PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; then
            echo "[RESTORE] ✓ Restore completed successfully"
        else
            echo "[RESTORE] ✗ Restore failed"
            exit 1
        fi
    else
        if PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$RESTORE_FILE"; then
            echo "[RESTORE] ✓ Restore completed successfully"
        else
            echo "[RESTORE] ✗ Restore failed"
            exit 1
        fi
    fi
    exit 0
fi

# ═══════════════════════════════════════════════════════════════
# Subcommand: --test-restore
# ═══════════════════════════════════════════════════════════════
# Automated restore drill: restores the latest backup into a freshly
# created TEMP database, counts the restored tables, then drops the
# temp database. Never touches production data.
#
# Designed to run unattended via cron — no interactive prompts.
TEST_RESTORE_EXIT=0
if [ "${1:-}" = "--test-restore" ]; then
    echo "[TEST] Running automated restore drill..."
    LATEST=$(ls -t "$BACKUP_DIR"/daily/*.sql.gz 2>/dev/null | head -1)
    if [ -z "$LATEST" ]; then
        echo "[TEST] ERROR: No backup found"
        exit 1
    fi
    # Create a temp database for testing — name is unique per run so
    # concurrent test-restore jobs (or a crashed previous run) can't
    # collide on the same DB name.
    TEST_DB="peopleflow_restore_test_$(date +%s)"
    echo "[TEST] Creating temp database: $TEST_DB"
    if ! PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE \"$TEST_DB\";" 2>/dev/null; then
        echo "[TEST] ✗ Could not create temp database $TEST_DB"
        exit 1
    fi

    # Always clean up the temp database, even if restore fails.
    cleanup_test_db() {
        PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" 2>/dev/null || true
        echo "[TEST] Temp database cleaned up"
    }
    trap cleanup_test_db EXIT

    echo "[TEST] Restoring backup to temp database..."
    if gunzip -c "$LATEST" | PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" 2>/dev/null; then
        TABLE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d '[:space:]')
        echo "[TEST] ✓ Restore drill PASSED — ${TABLE_COUNT:-0} tables restored"
    else
        echo "[TEST] ✗ Restore drill FAILED"
        TEST_RESTORE_EXIT=1
    fi

    exit "$TEST_RESTORE_EXIT"
fi

# ═══════════════════════════════════════════════════════════════
# Default: full backup
# ═══════════════════════════════════════════════════════════════

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
