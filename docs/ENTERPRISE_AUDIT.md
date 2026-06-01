# PeopleFlow Enterprise Audit

_Last updated: 2026-06-01_

## Vision
PeopleFlow is being positioned as a premium HR/office operations platform for Bangladeshi offices: secure, Bengali-first, device-aware, scalable, and strong enough to replace existing office HR tools.

## Current Architecture Summary
- **App:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn-style components.
- **Auth:** NextAuth v5 beta with Prisma adapter and custom credentials flow.
- **Database:** PostgreSQL via Prisma ORM with multi-tenant organization model.
- **Queue/Workers:** Redis + BullMQ worker app for notifications, subscriptions, impersonation cleanup, usage tracking, biometric sync, device health, and attendance reconciliation.
- **Deployment:** Coolify Dockerfile build with separate app and worker resources, PostgreSQL, and Redis.
- **Localization:** Bengali/English support via next-intl/messages.

## P0 Critical Risks / Blockers Before Office Handover
1. **Production deployment instability**
   - Latest deploys fail after successful app build during Docker image finalization/export.
   - Immediate fix applied: reduce final image cache/layer size.
   - Next target: make deploy deterministic, faster, and reproducible with CI build gates.

2. **TypeScript build errors are currently ignored in Next config**
   - `next.config.ts` has `typescript.ignoreBuildErrors: true`.
   - This is acceptable only as temporary VPS survival mode if `tsc --noEmit` is mandatory elsewhere.
   - Enterprise target: CI/local typecheck must block merge; production build should not hide type errors long-term.

3. **Tenant isolation must be proven, not assumed**
   - Auth uses controlled RLS/platform bypass patterns such as `withPlatform()`.
   - This can be correct, but must be backed by tests ensuring one organization cannot read/write another organization’s data.

4. **RBAC/security gates need systematic verification**
   - Every route/action/API must enforce organization + role + feature-plan constraints.
   - Need automated tests for platform admin, tenant admin, manager, employee, and impersonation flows.

5. **Office pilot QA is not optional**
   - Leave approval, ESS, attendance, employee mapping, Bengali UX, device sync, and billing limits must pass a written release checklist before handover.

## Deployment / Build Pipeline Assessment
### Current Weaknesses
- Docker deploy is slow and fragile on the current small VPS.
- App and worker build from the same Dockerfile, duplicating effort.
- Runtime install of operational tools (`prisma`, `tsx`, `bcryptjs`) adds final image weight.
- No visible pre-deploy CI gate documented for lint/typecheck/test/build.

### Target Approach
- Add a required release gate: `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build`.
- Keep Docker image lean with standalone output and cache cleanup.
- Consider separate optimized worker Docker target later.
- Add health checks for app, DB, Redis, queue liveness, and worker heartbeat.
- When offices grow: move build workload off production server or use registry-based images.

## Security / RBAC / Multi-Tenant Concerns
- Remove or justify every `as any` in auth, workers, and shared hooks.
- Add tenant boundary tests for all critical models.
- Tighten Content Security Policy over time; current CSP allows `unsafe-inline` / `unsafe-eval` for compatibility.
- Verify secrets are runtime-only where possible; public envs must contain no secrets.
- Add audit logging for admin actions, impersonation, device sync, payroll/leave changes, and subscription changes.
- Add rate limiting for auth, sensitive API routes, and device sync endpoints.

## Database / Schema / Performance Concerns
- Review indexes for high-cardinality tenant queries: organizationId + date/status/employeeId combinations.
- Add query performance checks for attendance, leave, payroll, approvals, dashboard metrics, and device logs.
- Ensure soft-delete/status patterns do not leak data into active queries.
- Add migration discipline: migration review + backup before production deploy.

## UI/UX / Bengali Office Workflow Gaps
- Bengali must be first-class, not partial translation.
- Every table/list needs empty/loading/error states.
- ESS should clearly guide users when employee profile mapping is missing.
- Device UX must distinguish cloud-ready certified devices vs LAN-only devices requiring Sync Agent.
- Office admin flows should be task-based: “set up office”, “add employees”, “configure attendance”, “approve leave”, “run payroll”.

## Worker / Queue / Device Sync Assessment
- Worker design is strong in concept: separate process with BullMQ and cron jobs.
- Need operational visibility: queue dashboard/logs, failed job retry policy, dead-letter handling, worker heartbeat.
- Device sync should be idempotent and auditable.
- LAN-only biometric devices should remain Sync Agent-first; do not promise universal direct cloud compatibility.

## Priority Roadmap
### P0 — Stabilize
- Fix deploy instability and verify latest commit in production.
- Add explicit local/CI release gate.
- Remove hidden build failure risk from ignored type errors.
- Smoke test core production flows.

### P1 — Office Pilot Ready
- Tenant isolation + RBAC tests.
- Leave, ESS, attendance, employee mapping, device setup, Bengali UX QA.
- Admin onboarding checklist and setup wizard.
- Worker health and failed job monitoring.

### P2 — Scale Ready
- Performance index review.
- Build server/registry workflow.
- Backup/restore drills.
- Observability: Sentry/logs/metrics/alerts.
- Subscription billing and feature limit enforcement tests.

### P3 — Market Leadership
- Bangladesh compliance workflows.
- Advanced analytics and executive dashboards.
- Payroll export/integration options.
- Mobile-first ESS experience.
- Certified device vendor program.

## Immediate Implementation Tasks
1. Finish current optimized deployment and verify `/api/health`.
2. Run local gates: install, lint, typecheck, tests, build.
3. Add `docs/RELEASE_CHECKLIST.md` for office handover.
4. Add tenant isolation test suite.
5. Audit all `as any`, ignored build errors, inline styles, and auth bypass points.
6. Build production QA checklist for leave, ESS, attendance, devices, workers, and Bengali copy.
