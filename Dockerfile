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

# Cache-buster: change this value to force npm ci re-run
ARG CACHEBUST=3
RUN npm ci

# ───────────────────────────────────────
# Stage 2: Build the application
# ───────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# node_modules are already installed from deps stage (with devDeps)
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma generate
ENV DATABASE_URL="postgresql://prisma:prisma@localhost:5432/prisma"
RUN npx prisma generate

# CRITICAL: next build MUST run with NODE_ENV=production
ENV NODE_ENV=production
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
# Stage 4: Final production image (LEAN)
# ───────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# ── Copy with --chown to avoid expensive "RUN chown -R" layer ──
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Production node_modules
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Prisma schema + generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# i18n translation files
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages

# Entrypoint script
COPY --chown=nextjs:nodejs docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["/app/entrypoint.sh"]
