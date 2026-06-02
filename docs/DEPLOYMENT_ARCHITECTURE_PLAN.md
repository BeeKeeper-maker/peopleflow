# PeopleFlow Deployment Architecture Plan

_Last updated: 2026-06-02_

## Current State
The web app now deploys successfully using a lean Docker image. This fixed repeated Coolify failures caused by heavy runtime dependencies and Docker image unpack/finalization problems.

## What Changed
- Removed runtime `npm install prisma tsx bcryptjs` from the final web image.
- Hardened Docker `npm ci` with retry and timeout settings.
- Web container now skips DB migrations/seed by default:
  - `PEOPLEFLOW_RUN_BOOTSTRAP=false`
- Production app is healthy after deployment.

## Important Known Gap
The web image is now intentionally lean. This means migrations and seed/bootstrap must be handled explicitly, not hidden inside web app boot.

The worker runtime has now been split into a dedicated Docker target and deployed successfully. Migration/release execution remains the next explicit architecture task.

## Target Architecture

### 1. Web App Container
Purpose:
- Serve Next.js app
- Handle HTTP requests
- Connect to DB/Redis as needed

Rules:
- No heavy runtime install
- No automatic schema migration during normal boot
- Fast startup
- Health check at `/api/health`

### 2. Worker Container
Purpose:
- BullMQ workers
- Scheduled jobs
- Device sync
- Attendance reconciliation
- Subscription lifecycle jobs
- Notifications/email pipeline

Rules:
- Separate Docker target or image
- Includes worker runtime dependencies deliberately
- Has worker heartbeat/health check
- Fails loudly if Redis unavailable
- Does not expose public HTTP unless diagnostic endpoint is added

### 3. Migration / Release Job
Purpose:
- Run `prisma migrate deploy`
- Run idempotent seed/bootstrap when needed

Rules:
- Run before web rollout when schema changes exist
- Must be explicit and logged
- Must require DB backup before risky schema changes
- Must not run automatically on every web container restart

## Recommended Next Implementation

### Option A — Short-term Coolify-safe
- Keep web app as current lean image.
- Create a separate migration command/process in Coolify or manual release checklist.
- Keep worker on the dedicated `worker` Docker target now that it is stable.

### Option B — Proper Docker multi-target
Docker targets now exist:
- `runner` for web
- `worker` for BullMQ
- `migrate` for migrations/seed

Coolify state:
- peopleflow-app uses default `runner`
- peopleflow-worker uses `worker`
- migrations still need an explicit pre-deploy/release command where safe

### Option C — Mature CI/CD
- Build images in CI/build server
- Push to registry
- Coolify pulls image instead of building on production VPS
- Best for scale and many offices

## Recommendation
Use Option A immediately to stay stable. Then implement Option B before office pilot. Move to Option C when customer count/server load grows.

## Verification Gates
- [x] Web deploy succeeds after lean-image split
- [x] Web `/api/health` healthy
- [x] Worker process deploy path documented
- [x] Worker logs show all workers registered
- [ ] Migration command tested in non-destructive deploy
- [ ] Backup rule documented before schema changes

## 2026-06-02 Production Verification

- Web app: `running:healthy`; `/api/health` HTTP 200 with server/database/redis healthy.
- Worker app: `running:healthy`; latest deployment `df8ccmmz2zzf084ixd5bvv7w` finished at commit `94b1a3f` (`Add worker Docker healthcheck`).
- Worker deployment logs: image build completed, rolling update started, Dockerfile healthcheck passed on first attempt, old containers removed.
- Worker runtime logs: process starts via `npm run worker`; all 7 workers register and CRON jobs process.
- Remaining architecture task: formal migration/release job procedure with backup requirement before schema-changing deploys.
