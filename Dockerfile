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
ARG CACHEBUST=4
# VPS/package-registry connections can reset during large installs. Use explicit
# retry/timeout settings so transient npm network failures do not break deploys.
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    for attempt in 1 2 3; do \
        echo "[deps] npm ci attempt $attempt/3"; \
        npm ci --no-audit --no-fund && break; \
        status=$?; \
        if [ "$attempt" = "3" ]; then exit "$status"; fi; \
        echo "[deps] npm ci failed with exit $status; retrying in 20s..."; \
        npm cache verify || true; \
        sleep 20; \
    done

# ───────────────────────────────────────
# Stage 2: Build the application
# ───────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# node_modules are already installed from deps stage (with devDeps)
COPY --from=deps /app/node_modules ./node_modules
# Cache-buster: this RUN forces Docker to invalidate all subsequent layers.
# Change the string below to force a full rebuild.
RUN echo "cache-bust-2026-07-11-v1" > /tmp/.cachebust
COPY . .

# Prisma generate
ENV DATABASE_URL="postgresql://prisma:prisma@localhost:5432/prisma"
RUN for attempt in 1 2 3; do \
        echo "[prisma] generate attempt $attempt/3"; \
        npx prisma generate && break; \
        status=$?; \
        if [ "$attempt" = "3" ]; then exit "$status"; fi; \
        echo "[prisma] generate failed with exit $status; retrying in 20s..."; \
        sleep 20; \
    done

# CRITICAL: next build MUST run with NODE_ENV=production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ── Build-time placeholder env vars ──
# next build loads next.config.ts which imports env.ts and validates all required
# env vars. Coolify only injects real values at container RUNTIME, not build time.
# These placeholders satisfy the Zod schema validation during the build step.
# They are NOT baked into the final image — the runner stage starts clean and
# Coolify injects real env vars at container start.
ENV REDIS_URL="redis://build-placeholder:6379"
ENV NEXTAUTH_SECRET="build-placeholder-secret-minimum-32-chars-long!!"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV AUTH_SECRET="build-placeholder-secret-minimum-32-chars-long!!"
ENV AUTH_URL="http://localhost:3000"
ENV AUTH_TRUST_HOST="true"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV CRON_SECRET="build-placeholder-cron-secret-16chars"
ENV ENCRYPTION_KEY="build-placeholder-encryption-key-32chars!!"
ENV PLATFORM_JWT_SECRET="build-placeholder-jwt-secret-min32chars!!"
# Coolify kills long silent Docker build steps. Keep a lightweight heartbeat
# while Next.js compiles so production deploys don't fail during quiet periods.
RUN (while true; do echo "[build] Next.js build still running..."; sleep 30; done) & \
    heartbeat=$!; \
    npm run build; \
    status=$?; \
    kill "$heartbeat" 2>/dev/null || true; \
    exit "$status"

# ───────────────────────────────────────
# Stage 3A: Background worker image
# ───────────────────────────────────────
FROM node:20-alpine AS worker
# postgresql-client: needed so the bootstrap (entrypoint.sh) can run
#   ALTER ROLE peopleflow_app WITH PASSWORD '...'
#   for RLS enforcement when the worker image runs the bootstrap path.
RUN apk add --no-cache libc6-compat openssl postgresql-client
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PEOPLEFLOW_PROCESS=worker
# prisma generate needs a DATABASE_URL at build time (any valid-looking DSN works)
ENV DATABASE_URL="postgresql://prisma:prisma@localhost:5432/prisma"

COPY .npmrc* ./
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    (while true; do echo "[worker] npm ci still running..."; sleep 30; done) & \
    heartbeat=$!; \
    for attempt in 1 2 3; do \
        echo "[worker] npm ci attempt $attempt/3"; \
        npm ci --omit=dev --no-audit --no-fund && status=0 && break; \
        status=$?; \
        if [ "$attempt" = "3" ]; then break; fi; \
        echo "[worker] npm ci failed with exit $status; retrying in 20s..."; \
        npm cache verify || true; \
        sleep 20; \
    done; \
    kill "$heartbeat" 2>/dev/null || true; \
    exit "$status"

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./tsconfig.json

# Copy pre-generated Prisma client from builder stage instead of running
# npx prisma generate here. The worker stage uses --omit=dev so prisma
# isn't available, and npx downloads Prisma 7.8 which needs Node 22+.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/src/generated ./src/generated
RUN npm cache clean --force && rm -rf /root/.npm /root/.cache /tmp/*

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

USER nextjs

# Worker containers do not expose HTTP, but Coolify rolling updates expect a
# Docker health state when any Dockerfile HEALTHCHECK exists. Verify that the
# worker entrypoint is still alive instead of probing a web endpoint.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD ps | grep -v grep | grep -q "src/workers/start-workers" || exit 1

CMD ["npm", "run", "worker"]

# ───────────────────────────────────────
# Stage 3B: Explicit migration/seed release image
# ───────────────────────────────────────
FROM node:20-alpine AS migrate
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY .npmrc* ./
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    for attempt in 1 2 3; do \
        echo "[migrate] npm ci attempt $attempt/3"; \
        npm ci --omit=dev --no-audit --no-fund && break; \
        status=$?; \
        if [ "$attempt" = "3" ]; then exit "$status"; fi; \
        echo "[migrate] npm ci failed with exit $status; retrying in 20s..."; \
        npm cache verify || true; \
        sleep 20; \
    done

COPY prisma ./prisma
COPY scripts/runtime-seed.js ./scripts/runtime-seed.js
COPY scripts/provision-qa-tenant.js ./scripts/provision-qa-tenant.js

RUN npx prisma generate && \
    npm cache clean --force && \
    rm -rf /root/.npm /root/.cache /tmp/*

# Coolify rolling updates inspect Docker health state when a Dockerfile contains
# healthchecks in any stage. The migration target is a one-off release image, so
# mark it healthy only after the release command completes successfully.
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=5 \
    CMD test -f /tmp/peopleflow-migration-ok || exit 1

CMD ["sh", "-c", "node ./node_modules/prisma/build/index.js migrate deploy && node scripts/runtime-seed.js && touch /tmp/peopleflow-migration-ok && sleep 3600"]

# ───────────────────────────────────────
# Stage 3: Final production image (LEAN)
# ───────────────────────────────────────
FROM node:20-alpine AS runner
# postgresql-client (psql): required by docker/entrypoint.sh to set the
# peopleflow_app role password (RLS enforcement) at bootstrap time.
RUN apk add --no-cache openssl curl postgresql-client
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

# The Next.js standalone output already includes traced production runtime deps.
# Do NOT run production npm install here. It pulls hundreds of packages into the
# final image and has repeatedly caused Coolify/VPS failures while unpacking the
# Docker image. Database migrations/seed are handled as an explicit release step,
# not as heavy app-container boot work.

# Prisma schema + generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# i18n translation files
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages

# Minimal runtime files used by the web app and diagnostics.
# Worker runtime will be split into its own optimized target instead of bloating
# the web image with tsx/prisma CLI dependencies.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib ./src/lib

# Entrypoint + runtime seed scripts
COPY --chown=nextjs:nodejs docker/entrypoint.sh /app/entrypoint.sh
COPY --chown=nextjs:nodejs scripts/runtime-seed.js /app/scripts/runtime-seed.js
COPY --chown=nextjs:nodejs tools/sync-agent ./tools/sync-agent
RUN chmod +x /app/entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
# The same image can run either the Next.js web process or the BullMQ worker
# process. Web containers must answer /api/health. Worker containers do not bind
# port 3000, so their health is the container/process staying alive; if the
# worker crashes, Docker marks the container exited and Coolify will fail it.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD if [ "$PEOPLEFLOW_PROCESS" = "worker" ]; then exit 0; else curl -f http://localhost:3000/api/health || exit 1; fi

CMD ["/app/entrypoint.sh"]
