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
- [ ] LAN-only biometric path routes to Sync Agent, not false direct cloud claim
- [ ] Worker/queue health is visible
- [ ] Failed background jobs are observable
- [ ] Database backup exists before schema-changing deploy
- [ ] Rollback plan documented
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
| P0 | Worker/migration architecture split | Partially resolved | Worker Docker target deployed successfully on 2026-06-02 (`94b1a3f`) with Docker healthcheck; explicit migration/release job still needs final operational test before schema-changing deploys. |
| P0 | TypeScript ignored in Next production build | Mitigated, keep open | Local `npx tsc --noEmit` passed on 2026-06-02; build still skips validation, so CI/local type gate must remain mandatory. |
| P0 | Tenant isolation proof | Open | Must add tests proving one office cannot access another office's data. |
| P1 | Office pilot QA checklist execution | In progress | 2026-06-02 browser smoke: dashboard, employees, leave requests, attendance, devices, ESS attendance load. Bengali/date/policy issues remain. |
| P1 | Competitor matrix before major UX refactor | Open | Research plan exists; matrix pending. |

## Latest Gate Result — 2026-06-02

- Coolify web app: `running:healthy`.
- Coolify worker: latest deployment `df8ccmmz2zzf084ixd5bvv7w` finished at commit `94b1a3f`; Dockerfile worker healthcheck passed and rolling update completed.
- Worker logs: all 7 workers registered (`event-pipeline`, `subscription-lifecycle`, `impersonation-cleanup`, `usage-tracking`, `biometric-sync`, `device-health`, `attendance-reconciliation`) and recurring jobs are processing.
- `/api/health`: HTTP 200; server/database/redis healthy; memory check warning observed (`heapUsedMB` close to `heapTotalMB`) and should be watched, not treated as fatal yet.
- Local gates: `npm run lint` passed with 0 errors / 348 warnings; `npx tsc --noEmit` passed; `npm run build` passed with one Turbopack NFT trace warning; `npm test` passed 9 files / 268 tests.
- Browser smoke: tenant dashboard, employee directory, leave requests, attendance, biometric devices, and ESS attendance loaded in production session.
- QA findings: Bengali mode still shows English labels in places (`Employee Directory`, `Total Employees`, device guidance headings, English weekday/date formatting). ESS attendance future days are correctly `আসন্ন`; current day without check-in shows `অনুপস্থিত`, which needs office policy confirmation.

## Rule
If a release fails any P0 item, it is not office-ready. It may still be deployed for internal stabilization if the risk is documented.
