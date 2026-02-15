# PeopleFlow HRMS - Docker Configuration
# Multi-stage build for production deployment

# ═══════════════════════════════════════
# Stage 1: Install Dependencies
# ═══════════════════════════════════════
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy .npmrc for legacy-peer-deps support
COPY .npmrc* ./
COPY package.json package-lock.json* ./
RUN npm ci

# ═══════════════════════════════════════
# Stage 2: Build Application
# ═══════════════════════════════════════
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for PostgreSQL
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ═══════════════════════════════════════
# Stage 3: Production Runner
# ═══════════════════════════════════════
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy full node_modules (needed for prisma db push at startup)
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema (needed for db push)
COPY --from=builder /app/prisma ./prisma

# Copy i18n translation files (next-intl needs these at runtime)
COPY --from=builder /app/messages ./messages

# Create entrypoint script
RUN printf '#!/bin/sh\nset -e\necho "=== PeopleFlow HRMS Starting ==="\necho "Syncing database schema..."\nnpx prisma db push --skip-generate --accept-data-loss 2>&1\necho "Database ready!"\necho "Starting server..."\nexec node server.js\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["/app/entrypoint.sh"]
