#!/bin/sh
set -e

echo "══════════════════════════════════════════════"
echo "  PeopleFlow HRMS — Production Server"
echo "══════════════════════════════════════════════"
echo "  Node:  $(node --version)"
echo "  Time:  $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "══════════════════════════════════════════════"
echo ""

echo "[BOOT] Step 1/3: Running database migrations..."
if npx prisma migrate deploy 2>&1; then
    echo "[BOOT] ✅ Database migrations applied successfully"
else
    MIGRATE_EXIT=$?
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  FATAL: Database migration failed (exit code: $MIGRATE_EXIT)  ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Possible causes:"
    echo "    1. DATABASE_URL is incorrect or database is unreachable"
    echo "    2. Migration files are corrupted or out of sync"
    echo "    3. Database user lacks ALTER/CREATE permissions"
    echo ""
    echo "  To fix:"
    echo "    - Check DATABASE_URL environment variable"
    echo "    - Run: npx prisma migrate status"
    echo "    - Run: npx prisma migrate resolve --applied <migration>"
    echo ""
    echo "  Server will NOT start with an inconsistent database."
    echo "  This is a safety measure to prevent data corruption."
    exit 1
fi

echo ""
echo "[BOOT] Step 2/3: Seeding platform admin (idempotent)..."
node -e "
const { PrismaClient } = require('./src/generated/prisma');
const { hash } = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
    const email = process.env.PLATFORM_ADMIN_EMAIL || 'platform@peopleflow.app';
    const password = process.env.PLATFORM_ADMIN_PASSWORD || 'PlatformAdmin@2026!';
    
    const existing = await prisma.platformAdmin.findUnique({ where: { email } });
    if (existing) {
        console.log('[BOOT]   Platform Admin already exists: ' + email);
        return;
    }
    
    const hashed = await hash(password, 12);
    await prisma.platformAdmin.create({
        data: {
            email,
            password: hashed,
            name: 'Platform Administrator',
            role: 'platform_super',
            isActive: true,
        },
    });
    console.log('[BOOT]   ✅ Created Platform Admin: ' + email);
}

seed()
    .catch(e => console.error('[BOOT]   ⚠️  Platform admin seed failed (non-fatal):', e.message))
    .finally(() => prisma.\$disconnect());
" 2>&1 || echo "[BOOT] ⚠️  Seed step failed (non-fatal, continuing)"

echo ""
echo "[BOOT] Step 3/3: Starting Next.js server..."
exec node server.js
