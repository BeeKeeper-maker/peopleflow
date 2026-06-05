# PeopleFlow Release Checklist

_Last updated: 2026-06-02_

## Purpose
No PeopleFlow release should go to production or office handover with hidden risk. This checklist is the minimum gate before claiming a release is ready.

## Release Levels

### R0 — Deploy Smoke Release
Use after every deploy.

- [ ] Coolify deployment status is `finished`
- [ ] App status is `running:healthy`
- [ ] `/api/health` returns HTTP 200
- [ ] Health checks show server/database/redis healthy
- [ ] App logs show clean boot with no fatal errors
- [ ] Login page loads
- [ ] Existing production data is still present
- [ ] No new repeated error logs within first 5 minutes

### R1 — Internal QA Release
Use before Sir/client demo.

- [ ] `npm run lint` passes or all findings documented
- [ ] `npx tsc --noEmit` passes or all findings documented as blockers
- [ ] `npm run build` passes locally or in CI
- [ ] Core auth works: platform admin, tenant admin, employee
- [ ] Tenant admin dashboard loads
- [ ] Employee list loads
- [ ] Leave request create/list/approve flow works
- [ ] ESS attendance screen loads and future dates are not falsely absent
- [ ] Bengali UI copy on tested screens is readable and professional
- [ ] Empty/loading/error states are acceptable on tested screens

### R2 — Office Pilot Release
Use before giving to a real office.

- [ ] Tenant isolation tests pass
- [ ] RBAC tests pass for platform admin, tenant admin, manager, employee
- [ ] Employee onboarding/import tested
- [ ] Leave policy setup tested
- [ ] Attendance policy/shift setup tested
- [ ] Device setup path is clearly explained
- [x] LAN-only biometric path routes to Sync Agent, not false direct cloud claim
- [ ] Worker/queue health is visible
- [ ] Failed background jobs are observable
- [x] Database backup exists before schema-changing deploy
- [x] Rollback plan documented
- [ ] Office admin can understand next steps without developer help

### R3 — Paid Customer Release
Use before paid subscriptions or broader rollout.

- [ ] Billing/subscription limits enforced
- [ ] Audit logs cover sensitive admin actions
- [ ] Rate limiting enabled for auth and sensitive endpoints
- [ ] Error monitoring/alerts configured
- [ ] Uptime monitoring configured
- [ ] Backup restore drill completed
- [ ] Performance baseline captured
- [ ] Support/debug dashboard available
- [ ] Data export/migration plan available

## Current Known Release Blockers

| Priority | Blocker | Status | Notes |
|---|---|---|---|
| P0 | Worker/migration architecture split | Mostly resolved / RLS blocked | Worker Docker target deployed successfully on 2026-06-02 (`94b1a3f`) with Docker healthcheck; migration runbook added; fresh local `prisma migrate deploy` proof passed after documenting required `CREATEROLE`. However RLS runtime integration is not release-safe yet, so production schema-changing deploy must wait for backup verification and RLS route audit/deferral decision. |
| P0 | TypeScript ignored in Next production build | Mitigated, keep open | Local `npx tsc --noEmit` passed on 2026-06-02; build still skips validation, so CI/local type gate must remain mandatory. |
| P0 | Tenant isolation proof | In progress | Automated tenant/RBAC guard tests and RLS migration coverage added on 2026-06-02; route-level integration/browser proof still pending. |
| P1 | Office pilot QA checklist execution | In progress | 2026-06-05 production browser probe: 10/10 core pages loaded. Dashboard chart labels/admin leave-apply Bengali leaks fixed. Device handover copy corrected to avoid unverified ADMS/direct-cloud promise; deeper workflow QA still pending. |
| P1 | Competitor matrix before major UX refactor | Open | Research plan exists; matrix pending. |

## Latest Gate Result — 2026-06-02

- Coolify web app: `running:healthy`.
- Coolify DB backup schedule: `bkxocg8v2jjmbj7smfqfrpws`, daily `0 3 * * *` server time, 7 local backups / 7 days, S3 disabled; executions verified successful on 2026-06-03, 2026-06-04, and 2026-06-05.
- Coolify worker: latest deployment `df8ccmmz2zzf084ixd5bvv7w` finished at commit `94b1a3f`; Dockerfile worker healthcheck passed and rolling update completed.
- Worker logs: all 7 workers registered (`event-pipeline`, `subscription-lifecycle`, `impersonation-cleanup`, `usage-tracking`, `biometric-sync`, `device-health`, `attendance-reconciliation`) and recurring jobs are processing.
- `/api/health`: HTTP 200; server/database/redis healthy; memory check warning observed (`heapUsedMB` close to `heapTotalMB`) and should be watched, not treated as fatal yet.
- Local gates: full `npm run lint` passed with 0 errors / 348 warnings; full `npx tsc --noEmit` passed; full `npm test` passed 12 files / 288 tests; `npm run build` passed with one Turbopack NFT trace warning. Additional focused tenant/RBAC/RLS/route-guard tests passed: 3 files / 20 tests. Targeted changed-file lint passed with 0 errors / 1 existing image warning.
- Browser smoke: tenant dashboard, employee directory, add employee, leave requests, admin leave apply, attendance, biometric devices, ESS attendance, shifts, and approval workflows loaded in production session.
- QA findings: Employee Directory core labels/actions/filters, ESS Attendance date/day/time formatting, and Devices/Sync Agent guidance copy were localized after initial smoke. ESS current-day no-record state now shows “এখনো চিহ্নিত হয়নি” instead of falsely showing absent. 2026-06-05 pass fixed dashboard chart labels (`Hires`, `Exits`, `total`) and admin leave-apply heading/subtitle/toasts/dropdown allocation text. Device copy now explicitly says beta-supported path is Sync Agent and direct ADMS/cloud push requires exact-model verification.

## Rule
If a release fails any P0 item, it is not office-ready. It may still be deployed for internal stabilization if the risk is documented.
