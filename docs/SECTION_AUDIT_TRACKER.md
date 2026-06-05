# PeopleFlow Section Audit Tracker

_Last updated: 2026-06-02_

## Purpose
PeopleFlow will be upgraded section-by-section. Each section must be inspected deeply before major refactor or feature expansion.

## Audit Fields
For every section, capture:

- Current behavior
- Target users/roles
- Data models involved
- APIs/server actions involved
- Tenant isolation requirements
- RBAC requirements
- Validation/error handling
- Loading/empty/error UI states
- Bengali copy quality
- Mobile/responsive quality
- Performance/index concerns
- Worker/queue dependencies
- Security/privacy concerns
- Competitor inspiration
- P0/P1/P2/P3 tasks
- Verification gate

## Section Status Table

| Section | Status | Priority | Main Risk | Next Action |
|---|---|---:|---|---|
| Deployment & Infrastructure | Stabilized, monitor | P0 | Web + worker healthy; local migration deploy proof passed; DB backups verified on 2026-06-03/04/05 | Test production one-off migrate path before schema-changing deploy |
| Auth & Sessions | Not audited | P0 | Security, credentials, role handling, tenant status enforcement | Full auth/RBAC code audit |
| Tenant Isolation | Blocked for RLS activation | P0 | 2026-06-05 scan: only 7/115 API route files use explicit `withTenant`/`withPlatform`; forced RLS can hide app data | Audit/convert routes before enabling production RLS, or explicitly defer forced-RLS activation |
| Platform Admin / SaaS Plans | Not audited | P1 | Plan limits/billing psychology may be incomplete | Audit plan enforcement and UI |
| Employee Management | Not audited | P1 | Core office workflow; data quality and import UX matter | Review CRUD, import, profile mapping |
| Leave Management | Partially improved | P1 | Approval workflow and Bengali table UX need QA | Browser QA + policy edge cases |
| Attendance | Partially improved | P1 | Future date handling fixed; device/sync edge cases remain | Audit attendance policy, shifts, reconciliation |
| Biometric Devices / Sync Agent | Beta-ready with guided setup | P1 | Native ADMS/direct-cloud push is not implemented; beta-safe path is office PC Sync Agent + ZKTeco/local TCP compatibility | Physical device dry-run with exact model before client starts live attendance |
| ESS Portal | Partially improved | P1 | Missing profile state improved; full ESS needs QA | Audit attendance/leave/doc flows |
| Payroll | Not audited | P1/P2 | High sensitivity; compliance and correctness critical | Delay major expansion until employee/attendance stable |
| Worker / Queues / Cron | Partially stabilized | P0 | Worker deploy now succeeds, but queue observability and migration/release job gate remain incomplete | Add worker/queue health visibility and failed-job review path |
| Notifications / Email | Not audited | P2 | Delivery reliability unknown | Audit SMTP, templates, retries |
| Reports / Analytics | Not audited | P2 | Performance and usefulness unknown | Competitor-informed reporting plan |
| Bengali UX / Design System | In progress | P1 | Core QA pass found dashboard chart labels and admin leave-apply copy leaking English | Verify fixes after deploy, then continue remaining office-critical pages |
| Security Headers / CSP | Partially present | P1 | CSP may be permissive for compatibility | Review and harden gradually |
| Observability / Backups | Started | P0/P1 | Local DB backup schedule exists; off-server backup, restore drill, alerts, and queue failure visibility still missing | Verify first backup execution, then add off-server backup plan |

## Immediate Audit Order
1. Verify production-safe one-off migrate path before schema-changing deploy
2. Resolve/decide P0 forced-RLS route integration gap before production RLS activation
3. Browser QA Bengali mode for remaining office-critical pages after current fixes deploy
4. Worker / Queues observability and failed-job visibility
5. Auth / RBAC / Tenant Isolation route-level proof
6. Core office workflows: Employee → Leave → Attendance → ESS
7. Sir’s additional ideas
8. Competitor matrix and product differentiation

## Latest Audit Notes — 2026-06-02

- Deployment: web app, DB, Redis, and worker are currently healthy in Coolify.
- Worker: deploy `df8ccmmz2zzf084ixd5bvv7w` finished successfully at commit `94b1a3f`; Docker healthcheck passed; worker logs show all 7 workers registered and recurring jobs processing.
- Local quality gates: lint passed with warnings, typecheck passed, build passed, unit tests passed.
- Browser smoke: dashboard, employees, leave requests, attendance, devices, ESS attendance loaded successfully.
- Product/polish findings: Employee Directory core labels/actions/filters, ESS Attendance date/day/time formatting, and Biometric Devices/Sync Agent guidance copy have been localized. ESS current-day no-record state now avoids false absent.
- Backup/ops: Coolify local DB backup schedule `bkxocg8v2jjmbj7smfqfrpws` is running successfully; executions verified on 2026-06-03, 2026-06-04, and 2026-06-05.
- QA/polish: 2026-06-05 production browser probe loaded 10/10 office-critical screens; found Bengali leaks on dashboard chart labels and admin leave apply page, fixed locally pending deploy.
- Infra watch item: `/api/health` currently reports server/database/redis/memory healthy.

## Tenant/RBAC Proof Notes — 2026-06-02

- Added centralized tenant/RBAC guard helper tests for employee, leave, expense, and attendance access scenarios.
- Added RLS migration coverage test that checks all direct organization-scoped Prisma models have ENABLE/FORCE RLS and tenant isolation policies.
- Focused test result: 2 files / 16 tests passed.
- Remaining proof: route-level integration/browser checks for representative API endpoints. 2026-06-05 route scan found only 7/115 API route files using explicit `withTenant`/`withPlatform`, so production forced-RLS activation remains blocked.

## Migration Proof Notes — 2026-06-02

- Local full gates after adding route-level guard proof passed: `npm run lint`, `npx tsc --noEmit`, `npm test` (12 files / 288 tests), and `npm run build`.
- Local `npx prisma validate` passed.
- Local `npx prisma migrate status` initially failed because `.env` referenced a missing/underprivileged local `peopleflow` database role.
- Created/fixed local dev `peopleflow` role/database, then migration deploy exposed a real release requirement: migration `20260407104400_add_sync_api_key_table` creates role `peopleflow_app`, so migration user needs `CREATEROLE`.
- After granting local migration user `CREATEROLE` and resolving the failed local attempt as rolled back, `npx prisma migrate deploy` applied all 9 migrations and `migrate status` reported schema up to date.

## RLS Runtime Integration Finding — 2026-06-02

- After local migrations + seed, normal app connection showed dashboard data as empty because `FORCE ROW LEVEL SECURITY` is active and many routes still query through default `prisma` without setting tenant/platform context.
- Seed script also failed under normal app role; it succeeded only with local superuser maintenance URL.
- Conclusion: migration deploy/status passing is not enough. Before production RLS activation, either convert app-wide tenant data access to `withTenant`/`withPlatform`, or defer RLS migration activation with an explicit documented release decision.
