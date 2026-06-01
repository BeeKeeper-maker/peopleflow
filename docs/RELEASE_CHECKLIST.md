# PeopleFlow Release Checklist

_Last updated: 2026-06-01_

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
| P0 | Worker/migration architecture split | Open | Web image is now lean; worker and migration release path must be made explicit. |
| P0 | TypeScript ignored in Next production build | Open | `ignoreBuildErrors: true`; must be compensated with strict CI/local type gate. |
| P0 | Tenant isolation proof | Open | Must add tests proving one office cannot access another office's data. |
| P1 | Office pilot QA checklist execution | Open | Needs manual/browser QA across leave, ESS, attendance, devices, Bengali UX. |
| P1 | Competitor matrix before major UX refactor | Open | Research plan exists; matrix pending. |

## Rule
If a release fails any P0 item, it is not office-ready. It may still be deployed for internal stabilization if the risk is documented.
