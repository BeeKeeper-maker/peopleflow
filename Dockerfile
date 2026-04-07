# ═══════════════════════════════════════════════════════════════
# PeopleFlow HRMS — Production Dockerfile
# Industry best practices: multi-stage, non-root, health check
# ═══════════════════════════════════════════════════════════════

# ───────────────────────────────────────
# Stage 1: Install ALL dependencies
# ───────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# CRITICAL: Force development mode for npm ci so devDependencies (TypeScript) are installed.
# Coolify injects NODE_ENV=production as a build arg which would skip them.
ENV NODE_ENV=development

COPY .npmrc* ./
COPY package.json package-lock.json ./
RUN npm ci

# ───────────────────────────────────────
# Stage 2: Build the application
# ───────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Keep development mode for build (TypeScript, Tailwind, etc. are devDeps)
ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma generate needs a DATABASE_URL (dummy — not used for actual connection)
ENV DATABASE_URL="postgresql://prisma:prisma@localhost:5432/prisma"
RUN npx prisma generate

# Build Next.js in standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ───────────────────────────────────────
# Stage 3: Production-only dependencies
# ───────────────────────────────────────
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY .npmrc* ./
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ───────────────────────────────────────
# Stage 4: Final production image
# ───────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# ── Copy standalone server output ──
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# ── Copy production node_modules (includes prisma CLI for db push) ──
COPY --from=prod-deps /app/node_modules ./node_modules

# ── Copy Prisma schema + generated client ──
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# ── Copy i18n translation files ──
COPY --from=builder /app/messages ./messages

# ── Create entrypoint script (DB migration + server start) ──
# SECURITY: No --accept-data-loss. If migrations fail, the container
# stops and the orchestrator (Docker/K8s) reports the failure.
# This prevents silent data destruction in production.
RUN printf '#!/bin/sh\n\
set -e\n\
echo "══════════════════════════════════════════════"\n\
echo "  PeopleFlow HRMS — Production Server"\n\
echo "══════════════════════════════════════════════"\n\
echo "  Node:  $(node --version)"\n\
echo "  Time:  $(date -u +\"%%Y-%%m-%%dT%%H:%%M:%%SZ\")"\n\
echo "══════════════════════════════════════════════"\n\
echo ""\n\
echo "[BOOT] Step 1/2: Running database migrations..."\n\
if npx prisma migrate deploy 2>&1; then\n\
    echo "[BOOT] ✅ Database migrations applied successfully"\n\
else\n\
    MIGRATE_EXIT=$?\n\
    echo ""\n\
    echo "╔══════════════════════════════════════════════════════════╗"\n\
    echo "║  FATAL: Database migration failed (exit code: $MIGRATE_EXIT)  ║"\n\
    echo "╚══════════════════════════════════════════════════════════╝"\n\
    echo ""\n\
    echo "  Possible causes:"\n\
    echo "    1. DATABASE_URL is incorrect or database is unreachable"\n\
    echo "    2. Migration files are corrupted or out of sync"\n\
    echo "    3. Database user lacks ALTER/CREATE permissions"\n\
    echo ""\n\
    echo "  To fix:"\n\
    echo "    - Check DATABASE_URL environment variable"\n\
    echo "    - Run: npx prisma migrate status"\n\
    echo "    - Run: npx prisma migrate resolve --applied <migration>"\n\
    echo ""\n\
    echo "  Server will NOT start with an inconsistent database."\n\
    echo "  This is a safety measure to prevent data corruption."\n\
    exit 1\n\
fi\n\
echo ""\n\
echo "[BOOT] Step 2/2: Starting Next.js server..."\n\
exec node server.js\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Set file ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check with generous startup time for DB migration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["/app/entrypoint.sh"]
