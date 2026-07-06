#!/bin/sh
set -e

PROCESS_ROLE="${PEOPLEFLOW_PROCESS:-${PROCESS_ROLE:-web}}"

if [ "$PROCESS_ROLE" = "worker" ]; then
    SERVICE_LABEL="Background Worker"
    TOTAL_STEPS=3
else
    SERVICE_LABEL="Production Server"
    TOTAL_STEPS=4
fi

echo "══════════════════════════════════════════════"
echo "  PeopleFlow HRMS — $SERVICE_LABEL"
echo "══════════════════════════════════════════════"
echo "  Node:  $(node --version)"
echo "  Time:  $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "  Role:  $PROCESS_ROLE"
echo "══════════════════════════════════════════════"
echo ""

if [ "${PEOPLEFLOW_RUN_BOOTSTRAP:-false}" = "true" ]; then
    echo "[BOOT] Step 1/$TOTAL_STEPS: Running database migrations..."
    if node /app/node_modules/prisma/build/index.js migrate deploy 2>&1; then
        echo "[BOOT] ✅ Database migrations applied successfully"
    else
        MIGRATE_EXIT=$?
        echo ""
        echo "╔══════════════════════════════════════════════════════════╗"
        echo "║  FATAL: Database migration failed (exit code: $MIGRATE_EXIT)  ║"
        echo "╚══════════════════════════════════════════════════════════╝"
        echo ""
        echo "  Server will NOT start with an inconsistent database."
        exit 1
    fi

    echo ""
    echo "[BOOT] Step 2/$TOTAL_STEPS: Setting up RLS app role password..."
    # Set peopleflow_app password from env var for RLS enforcement
    if [ -n "$PF_APP_DB_PASSWORD" ]; then
        # Extract DB host and port from DATABASE_URL
        DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

        # Use psql to set the password (connect as superuser)
        PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U peopleflow -d "$DB_NAME" -c \
            "ALTER ROLE peopleflow_app WITH PASSWORD '${PF_APP_DB_PASSWORD}';" 2>/dev/null && \
            echo "[BOOT] ✅ RLS app role password set" || \
            echo "[BOOT] ⚠️  Could not set RLS app role password (non-fatal for dev)"
    else
        echo "[BOOT] ⚠️  PF_APP_DB_PASSWORD not set — using migration default"
    fi
else
    echo "[BOOT] Step 1/$TOTAL_STEPS: Skipping DB migrations/seed (PEOPLEFLOW_RUN_BOOTSTRAP=false)."
    echo "[BOOT]          Run migrations as an explicit release step before schema changes."
    echo ""
    echo "[BOOT] Step 2/$TOTAL_STEPS: Skipping RLS role setup (no bootstrap)."
fi

if [ "$PROCESS_ROLE" = "worker" ]; then
    echo ""
    echo "[BOOT] Step 3/$TOTAL_STEPS: Worker runtime is not included in this lean web image."
    echo "[BOOT]          Deploy the dedicated worker image/target for BullMQ workers."
    exit 1
fi

if [ "${PEOPLEFLOW_RUN_BOOTSTRAP:-false}" = "true" ]; then
    echo ""
    echo "[BOOT] Step 3/$TOTAL_STEPS: Running runtime seed..."
    node /app/scripts/runtime-seed.js 2>&1
else
    echo "[BOOT] Step 3/$TOTAL_STEPS: Skipping runtime seed (no bootstrap)."
fi

echo ""
echo "[BOOT] Step 4/$TOTAL_STEPS: Starting Next.js server..."
exec node server.js
