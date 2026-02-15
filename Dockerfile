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
# Dummy DATABASE_URL needed only for prisma generate (not actual connection)
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

# Copy built assets from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema + generated client + CLI (needed for DB migration at startup)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy i18n translation files (next-intl needs these at runtime)
COPY --from=builder /app/messages ./messages

# Create entrypoint script (runs DB migration + starts server)
RUN printf '#!/bin/sh\necho "Running database schema sync..."\nnode node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 || echo "Warning: DB sync failed, starting server anyway"\necho "Starting server..."\nnode server.js\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check — longer start-period for cold start, curl is more reliable
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start with DB sync + server
CMD ["/app/entrypoint.sh"]
