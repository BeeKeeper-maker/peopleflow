# PeopleFlow Production Release Runbook

_Last updated: 2026-06-02_

## Purpose
This runbook exists to prevent accidental production data loss while PeopleFlow moves toward office pilot readiness.

## Current Production Resources

- Web app: `peopleflow-app` (`r10swl7h0prw6h5wd2ypr9q3`)
- Worker app: `peopleflow-worker` (`n1yqagtyr4t3okmtn9kqr8kg`)
- PostgreSQL: `peopleflow-db` (`pdg62y96g744xohg9c5czhaa`)
- Redis: `peopleflow-redis` (`nkbtdrpt91xsgiak0cqusu7n`)
- Public URL: `https://peopleflowbd.online`

## Backup Rule

Before any schema-changing production deploy:

1. Confirm a recent database backup exists.
2. If no backup exists after the latest important data change, create or run one before deploying.
3. Do not run destructive Prisma commands in production.
4. Do not run `prisma migrate reset`, `prisma db push --force-reset`, or broad seed/reset scripts against production.
5. If a migration fails after partial execution, stop and inspect database state before retrying.

## Current Backup Schedule

Created on 2026-06-02:

- Backup UUID: `bkxocg8v2jjmbj7smfqfrpws`
- Frequency: `0 3 * * *` server time
- Scope: `peopleflow` database only
- Storage: local Coolify backup, no S3 yet
- Retention: 7 local backups / 7 days

Open follow-up:

- Verify first backup execution after the next scheduled run.
- Add S3/off-server backup before paid customer release.
- Perform restore drill before paid customer release.

## Normal Release Order

### 1. Local Quality Gates

Run from the project root:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Expected current behavior:

- Lint must exit with 0 errors. Warnings are currently accepted for beta but must trend down.
- Typecheck must pass because production Next build is configured to skip type validation.
- Build may emit non-fatal warnings; document them if present.

### 2. Migration Review

Before production deployment, inspect new migrations:

```bash
git diff --name-only origin/main...HEAD -- prisma/migrations prisma/schema.prisma
```

For each new migration:

- Read the SQL.
- Identify destructive statements (`DROP`, `TRUNCATE`, column type narrowing, `NOT NULL` without default/backfill, unique constraints on dirty data).
- Decide if a maintenance window is required.
- Confirm backup exists.

### 3. Deploy Code

- Deploy web app only after gates pass.
- Deploy worker after worker-affecting code changes.
- Keep app and worker on compatible commits.

### 4. Run Migration Release Step

Preferred target architecture already exists in Dockerfile:

- `runner`: web
- `worker`: BullMQ worker
- `migrate`: `npx prisma migrate deploy && node scripts/runtime-seed.js`

Operational proof completed locally on 2026-06-02:

- `npx prisma validate` passed.
- Fresh local PostgreSQL `peopleflow` database successfully ran `npx prisma migrate deploy` through all 9 migrations.
- `npx prisma migrate status` then reported: `Database schema is up to date!`

Important privilege requirement:

- Migration `20260407104400_add_sync_api_key_table` creates PostgreSQL role `peopleflow_app`.
- The migration user therefore needs role/database owner-level privileges, specifically permission to create roles (`CREATEROLE`) for this migration path.
- Local proof initially failed with PostgreSQL `42501 permission denied to create role`; after granting `CREATEROLE` to the local migration user and marking the failed local migration attempt rolled back, deploy completed successfully.
- Before production schema-changing deploy, verify the Coolify/PostgreSQL migration credential can run role-creating migrations, or pre-create `peopleflow_app` with explicit approval and then run `npx prisma migrate deploy`.

### 5. Post-Deploy Smoke

Verify:

- Coolify web app `running:healthy`
- Coolify worker `running:healthy`
- `https://peopleflowbd.online/api/health` returns HTTP 200
- Health checks show server/database/redis healthy
- Worker logs show all workers registered
- Login/dashboard loads
- Core pages load: employees, leave requests, attendance, devices, ESS attendance
- No repeated fatal logs within first 5 minutes

## Rollback Guidance

Prefer image/code rollback first.

If a schema migration already ran:

1. Do not guess.
2. Inspect the migration and affected tables.
3. Check backup availability.
4. Decide whether app rollback is compatible with the new schema.
5. Restore database only with explicit approval and a clear data-loss window.

## Current Known Watch Items

- `/api/health` reports memory warning while server/database/redis are healthy; monitor.
- Lint has warnings that should be reduced before broader office rollout.
- Bengali mode polish is in progress: Employee Directory, ESS Attendance, and Devices guidance were improved; remaining pages still need audit.
- Tenant isolation/RBAC proof has automated guard + RLS migration coverage and static route-level regression proof for employee/leave/expense/attendance APIs; browser workflow proof remains before office pilot.
