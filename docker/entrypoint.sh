#!/bin/sh
set -e

PROCESS_ROLE="${PEOPLEFLOW_PROCESS:-${PROCESS_ROLE:-web}}"

if [ "$PROCESS_ROLE" = "worker" ]; then
    SERVICE_LABEL="Background Worker"
    TOTAL_STEPS=2
else
    SERVICE_LABEL="Production Server"
    TOTAL_STEPS=3
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
else
    echo "[BOOT] Step 1/$TOTAL_STEPS: Skipping DB migrations/seed (PEOPLEFLOW_RUN_BOOTSTRAP=false)."
    echo "[BOOT]          Run migrations as an explicit release step before schema changes."
fi

if [ "$PROCESS_ROLE" = "worker" ]; then
    echo ""
    echo "[BOOT] Step 2/$TOTAL_STEPS: Worker runtime is not included in this lean web image."
    echo "[BOOT]          Deploy the dedicated worker image/target for BullMQ workers."
    exit 1
fi

if [ "${PEOPLEFLOW_RUN_BOOTSTRAP:-false}" = "true" ]; then
    echo ""
    node /app/scripts/runtime-seed.js 2>&1
fi

echo ""
echo "[BOOT] Step 3/$TOTAL_STEPS: Starting Next.js server..."
exec node server.js
