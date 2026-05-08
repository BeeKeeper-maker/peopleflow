# PeopleFlow HRMS

PeopleFlow is a Bangladesh-focused HRMS beta for payroll, attendance, leave, approvals, employee records, platform administration, workers, and tenant-aware API access.

This repository is prepared for controlled beta deployment on Coolify with separate app, worker, Postgres, and Redis services.

## Safety Rules

- Do not run migrations against production unless the migration has been reviewed and explicitly approved.
- Do not reset or seed production data.
- Do not commit `.env` or real secrets.
- Use local or disposable staging Postgres/Redis for verification before touching Coolify production services.
- Platform admin seeding is opt-in. If `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` are blank, no platform admin is created.

## Required Services

- Node.js 20
- PostgreSQL 16
- Redis 7
- npm

Docker Compose is provided for local/staging parity. The compose file requires explicit `POSTGRES_PASSWORD` and `REDIS_PASSWORD`; it no longer falls back to public default passwords.

## Environment

Copy the template and fill local or staging values:

```bash
cp .env.example .env
```

Minimum beta variables:

- `DATABASE_URL`
- `REDIS_URL`
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `NEXTAUTH_SECRET` with at least 32 characters
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `PLATFORM_JWT_SECRET`
- `CRON_SECRET`
- Stripe keys if billing/webhook flows are enabled
- SMTP values if email delivery is enabled

Production platform admin seeding requires both:

- `PLATFORM_ADMIN_EMAIL`
- `PLATFORM_ADMIN_PASSWORD` with at least 16 characters, uppercase, lowercase, number, and symbol

Leave both blank when you do not want boot-time admin creation.

## Local Verification

Install dependencies:

```bash
npm ci
```

Validate Prisma and generate the client:

```bash
npx prisma validate
npx prisma generate
```

If a safe local database is available, apply migrations only to that local database:

```bash
npx prisma migrate deploy
```

Run release gates:

```bash
npm audit --omit=dev
npm audit
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
```

Current expected gate behavior:

- Lint must exit with 0 errors. Warnings remain and should be reduced before general availability.
- Build may log Redis connection warnings if no local Redis is running.
- Full E2E should pass without a database because the current suite covers public/auth/API boundary behavior.

## Local Docker Compose

Use only with disposable local data:

```bash
docker compose up -d db redis
npx prisma migrate deploy
npm run dev
```

For full local stack:

```bash
docker compose up --build
```

Never point `DATABASE_URL` at the Coolify production database from local commands.

## Coolify Beta Runbook

Expected services:

- `peopleflow-app`
- `peopleflow-worker`
- `peopleflow-db`
- `peopleflow-redis`

Before deployment:

1. Confirm a database backup exists.
2. Confirm `DATABASE_URL` points to `peopleflow-db`, not an external or local database.
3. Confirm `REDIS_URL` points to `peopleflow-redis` and includes the Redis password.
4. Confirm `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` use the public beta URL.
5. Confirm `NEXTAUTH_SECRET`, `PLATFORM_JWT_SECRET`, `CRON_SECRET`, `POSTGRES_PASSWORD`, and `REDIS_PASSWORD` are unique production-grade secrets.
6. Confirm Stripe webhook endpoint is configured for `/api/webhooks/stripe` and uses the matching `STRIPE_WEBHOOK_SECRET`.
7. Confirm app and worker share the same `DATABASE_URL`, `REDIS_URL`, auth secrets, SMTP settings, and storage volume/config.
8. Keep `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` blank unless intentionally creating the first platform admin.

Deployment order:

1. Deploy image to staging or beta only after local gates pass.
2. Run `npx prisma migrate status` against staging/beta to inspect state.
3. Run `npx prisma migrate deploy` only after approval.
4. Start or restart `peopleflow-app` and `peopleflow-worker` after migrations complete.
5. Verify `/api/health`, login, platform login, protected API 401 behavior, file upload/download, Stripe webhook test event, and worker logs.

Rollback notes:

- Prefer image rollback first.
- Do not run destructive Prisma commands on production.
- If a migration has already changed schema, review the migration and backup state before any database rollback.

## Security Notes

- Protected API routes return JSON `401`/`403` responses instead of HTML redirects.
- Normal tenant sessions are rejected when the organization is inactive or suspended.
- Upload paths are tenant-scoped under `uploads/<organizationId>/...` and download routes enforce the organization path segment.
- High-risk leave routes include organization scoping, but a full app-wide RLS review is still recommended before general availability.
- Rate limiting fails closed in production if Redis is unavailable.

## Known Beta Follow-Ups

- Rename Next `middleware.ts` to the Next 16 `proxy` convention.
- Reduce remaining lint warnings instead of suppressing them.
- Remove Redis connection attempts during build/static page collection.
- Expand E2E coverage for authenticated tenant workflows using a disposable seeded database.
- Complete app-wide tenant isolation/RLS verification beyond the high-risk routes patched for beta.
