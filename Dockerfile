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

COPY .npmrc* ./
COPY package.json package-lock.json ./
RUN npm ci

# ───────────────────────────────────────
# Stage 2: Build the application
# ───────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

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
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# ── Copy i18n translation files ──
COPY --from=builder /app/messages ./messages

# ── Create entrypoint script (DB migration + server start) ──
RUN printf '#!/bin/sh\n\
set -e\n\
echo "=== PeopleFlow HRMS Starting ==="\n\
echo "-> Running database migrations..."\n\
if npx prisma migrate deploy 2>&1; then\n\
    echo "OK: Database migrations applied"\n\
else\n\
    echo "WARN: Migration failed - server starting without migration"\n\
fi\n\
echo "-> Starting Next.js server..."\n\
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
