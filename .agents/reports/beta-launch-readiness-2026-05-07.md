# PeopleFlow Beta Launch Readiness Report

Date: 2026-05-07
Branch: beta-launch-hardening

## Summary

This pass prepared the branch for beta/staging push readiness, not production GA.
The current backup commit was pushed to GitHub before local fixes:

- Backup commit: `4b7d616 chore: beta launch hardening checkpoint`
- Remote branch: `origin/beta-launch-hardening`

New fixes from this pass are intentionally left uncommitted for review.

## Fixes Made

- Fixed clean disposable PostgreSQL migration failure by adding `20260407104400_add_sync_api_key_table` immediately before the existing RLS baseline, while preserving the old RLS migration checksum.
- Fixed seeded demo users so `emailVerified` is set on create/update, allowing real authenticated local smoke tests.
- Fixed development demo credential text from `Demo@123` to `Admin@123`.
- Fixed PWA asset access by excluding static JSON/webmanifest/html/txt/xml assets from `src/proxy.ts`, so `/manifest.json` and `/offline.html` are no longer redirected to login.

## Commands Verified

- `npm run lint`: passed with 0 errors and 417 warnings.
- `npx tsc --noEmit`: passed.
- `npx prisma validate`: passed.
- `npm test`: 9 files passed, 265 tests passed.
- `npm run build`: passed with 1 Turbopack NFT trace warning.
- `npm run test:e2e`: 21 Playwright tests passed.
- `npm audit`: passed with 0 vulnerabilities.
- Disposable DB migration: `prisma migrate deploy` applied all migrations successfully.
- Disposable DB status: schema up to date.
- Worker boot: all 7 workers registered and shut down cleanly.
- Health endpoint: returned 200 with database and Redis healthy.
- Authenticated role smoke: admin/hr dashboard and export/list 200; manager and employee role redirects correct; manager/employee denied HR-only employee/export APIs with 403; `/api/employees/me` returned 200 for all seeded roles.

## Local Infra Verified

- Redis installed via Homebrew and temporary Redis server started on local port 56379.
- PostgreSQL 16 already installed via Homebrew and temporary disposable DB started on local port 55432.
- Redis TCP ping returned `PONG`.
- PostgreSQL migrations and seed completed on disposable DB.
- Temporary Redis/Postgres processes and `/private/tmp/peopleflow-local-check` were removed after verification.

## Integration Checks

- Redis fallback: build/test run without ECONNREFUSED noise when `REDIS_URL` is supplied; build/test runtime disables Redis where intended.
- Queue/worker: worker process requires Redis preflight and booted all 7 BullMQ workers with CRON registration.
- Uploads: upload route scopes storage under `organizationId`, validates file type/extension/size, sanitizes filename prefix, and protected file serving rejects path traversal and cross-tenant paths.
- Stripe webhook: handler requires `stripe-signature`, verifies payload with `STRIPE_WEBHOOK_SECRET`, and uses Redis event idempotency with DB invoice duplicate checks. Live Stripe CLI/event replay still needs staging secrets.
- Export: `xlsx` is absent; CSV and Excel-compatible `.xls` export paths use spreadsheet formula sanitization; authenticated employee export returned 200 CSV.
- PWA: `next-pwa` is absent; manual service worker and manifest are present. `/sw.js`, `/manifest.json`, and `/offline.html` returned 200 after proxy fix.
- Proxy migration: Next.js build shows `ƒ Proxy (Middleware)`, confirming `proxy.ts` is active.

## Tenant Isolation Audit Finding

All 112 API route handlers were inspected for auth guard, tenant scoping, role checks, or intentional public/system access.
Most tenant routes use explicit `organizationId` filters and role checks. The main unresolved architectural risk is that many handlers still use the default `prisma` client rather than `auth.withDB()`/`withTenant()`.

RLS proof:

- Without tenant context, app DB role sees `0` users.
- With `app.current_tenant_id` set to demo organization, app DB role sees `5` users.

Impact:

- If staging connects using the RLS app role, current `requireAuth()` and many routes can fail because they query before setting tenant context.
- If staging connects using a table owner/superuser-style role, RLS is not the real protection and app-level `organizationId` scoping is carrying isolation.

Recommendation before production GA:

- Decide the DB runtime role model.
- If enforcing RLS, migrate authenticated route DB operations to `auth.withDB()` and adjust auth bootstrap to resolve user/session safely.
- Add automated cross-tenant tests for read/write/update/delete.

## Route Audit Table

| Route | Methods | Guard | Tenant scoped | Role check |
| --- | --- | --- | --- | --- |
| /api/announcements/:id | PUT,DELETE | tenant-session | yes | yes |
| /api/announcements | GET,POST | tenant-session | yes | yes |
| /api/approval-workflows/:id | PUT,DELETE | tenant-session | yes | yes |
| /api/approval-workflows | GET,POST | tenant-session | yes | yes |
| /api/attendance/check-in | POST,PUT | tenant-session | yes | self-service |
| /api/attendance/regularization/:id | PUT | tenant-session | yes | yes |
| /api/attendance/regularization | GET,POST | tenant-session | yes | yes |
| /api/attendance | GET | tenant-session | yes | yes |
| /api/attendance/today | GET | tenant-session | yes | self-service |
| /api/audit-logs | GET | tenant-session | yes | yes |
| /api/auth/2fa/setup | POST,DELETE | session via getApiUser | user-scoped | self-service |
| /api/auth/2fa/verify | POST | session via getApiUser | user-scoped | self-service |
| /api/auth/:...nextauth | handler | Auth.js public handler | n/a | n/a |
| /api/auth/change-password | POST | session | user-scoped | self-service |
| /api/auth/forgot-password | POST | public | n/a | n/a |
| /api/auth/register | POST | public registration | organization create | n/a |
| /api/auth/reset-password | POST,GET | token-based public | n/a | n/a |
| /api/auth/verify-email | GET,POST | token-based public | n/a | n/a |
| /api/billing/checkout | POST | session | yes | admin-level |
| /api/billing/status | GET | session | yes | yes |
| /api/biometric-devices/:id | GET,PUT,DELETE | tenant-session | yes | yes |
| /api/biometric-devices/:id/sync | POST | tenant-session | yes | yes |
| /api/biometric-devices/:id/test | POST | tenant-session | yes | yes |
| /api/biometric-devices/:id/users | GET | tenant-session | yes | yes |
| /api/biometric-devices/auto-map | POST | tenant-session | yes | yes |
| /api/biometric-devices | GET,POST | tenant-session | yes | yes |
| /api/branches/:id | GET,PUT,DELETE | tenant-session | yes | yes |
| /api/branches | GET,POST | tenant-session | yes | yes |
| /api/cron/auto-absent | GET | cron-secret | all active orgs | system |
| /api/cron/escalation | GET | cron-secret | all overdue approvals | system |
| /api/cron/health-ping | GET | cron-secret | sync-key/org scoped | system |
| /api/cron/leave-allocation | GET | cron-secret | all active orgs | system |
| /api/dashboard/analytics | GET | tenant-session | yes | role-derived |
| /api/dashboard/stats | GET | tenant-session | yes | role-derived |
| /api/departments/:id | GET,PUT,DELETE | tenant-session | yes | yes |
| /api/departments | GET,POST | tenant-session | yes | yes |
| /api/designations/:id | GET,PUT,DELETE | tenant-session | yes | yes |
| /api/designations | GET,POST | tenant-session | yes | yes |
| /api/documents/generate | POST,GET | tenant-session | yes | yes |
| /api/employees/:id/profile-data | GET | tenant-session | yes | yes |
| /api/employees/:id | GET,PUT,DELETE | tenant-session | yes | yes |
| /api/employees/export | GET | tenant-session | yes | HR/admin only |
| /api/employees/me | GET,PATCH | tenant-session | yes | self-service |
| /api/employees/next-code | GET | tenant-session | yes | HR/admin only |
| /api/employees | POST,GET | tenant-session | yes | HR/admin only |
| /api/ess/document-request | GET,POST | tenant-session | yes | self-service |
| /api/expenses/categories | GET,POST | session | yes | yes |
| /api/expenses/claims/:id | GET,PATCH,DELETE | session | yes | yes |
| /api/expenses/claims | GET,POST | session | yes | yes |
| /api/health | GET | public health | n/a | n/a |
| /api/holidays/:id | POST,PUT,DELETE | tenant-session | yes | yes |
| /api/holidays | GET,POST | tenant-session | yes | yes |
| /api/leads | POST | public lead capture | n/a | n/a |
| /api/leaves/allocations | GET,POST,PUT | session | yes | yes |
| /api/leaves/applications/:id | GET,PUT | tenant-session | yes | yes |
| /api/leaves/applications | GET,POST | tenant-session | yes | yes |
| /api/leaves/carry-forward | POST | tenant-session | yes | yes |
| /api/leaves/encashment | POST,GET | tenant-session | yes | yes |
| /api/leaves/types/:id | GET,PUT,DELETE | tenant-session | yes | yes |
| /api/leaves/types | GET,POST | tenant-session | yes | yes |
| /api/loans/:id/repayments | GET,POST | tenant-session | yes | loan/HR scoped |
| /api/loans/:id | PUT,DELETE | tenant-session | yes | yes |
| /api/loans | GET,POST | tenant-session | yes | yes |
| /api/notifications | GET,POST,PATCH | tenant-session | yes | yes |
| /api/payroll/assignments | GET,POST | tenant-session | yes | yes |
| /api/payroll/bank-file | POST | tenant-session | yes | yes |
| /api/payroll/festival-bonus | GET,POST | tenant-session | yes | yes |
| /api/payroll/payslips | GET | tenant-session | yes | self/HR scoped |
| /api/payroll/pf-ledger | GET | tenant-session | yes | yes |
| /api/payroll/process | GET,POST | tenant-session | yes | yes |
| /api/payroll/slips/:id/download | GET | session | yes | yes |
| /api/payroll/structures/:id | PUT,DELETE | tenant-session | yes | yes |
| /api/payroll/structures | GET,POST | tenant-session | yes | yes |
| /api/payroll/tax-certificate | POST | tenant-session | yes | yes |
| /api/performance/goals/:id | GET,PATCH,DELETE | session | yes | ownership scoped |
| /api/performance/goals | GET,POST | session | yes | ownership scoped |
| /api/platform/analytics | GET | platform-jwt | platform-wide | platform |
| /api/platform/audit-logs | GET | platform-jwt | platform-wide | platform |
| /api/platform/auth | POST,GET | platform auth | n/a | platform |
| /api/platform/employees/:id/profile-data | GET | platform-jwt | platform-wide | platform |
| /api/platform/employees/:id | GET | platform-jwt | platform-wide | platform |
| /api/platform/impersonate | POST,DELETE | platform-jwt | target tenant validated | platform |
| /api/platform/plans | GET,POST,PATCH | platform-jwt | platform-wide | platform |
| /api/platform/tenants/:id | GET,PATCH,DELETE | platform-jwt | target tenant | platform |
| /api/platform/tenants/:id/status | PATCH | platform-jwt | target tenant | platform |
| /api/platform/tenants/:id/subscription | PATCH | platform-jwt | target tenant | platform |
| /api/platform/tenants/provision | POST | platform-jwt | creates tenant | platform |
| /api/platform/tenants | GET | platform-jwt | platform-wide | platform |
| /api/policies/late-deduction | GET,POST | tenant-session | yes | yes |
| /api/rbac/delegations | GET,POST,DELETE | tenant-session | yes | yes |
| /api/recruitment/jobs/:id | GET,PATCH,DELETE | session | yes | yes |
| /api/recruitment/jobs | GET,POST | session | yes | yes |
| /api/reports/attendance | GET | tenant-session | yes | yes |
| /api/reports | GET | tenant-session | yes | yes |
| /api/search | GET | session | yes | route/result scoped |
| /api/settings/geo-fence | GET,PATCH | tenant-session | yes | yes |
| /api/settings/notifications | GET,PATCH | tenant-session | yes | yes |
| /api/settings | GET,PATCH | tenant-session | yes | yes |
| /api/shifts/:id | PUT,DELETE | tenant-session | yes | yes |
| /api/shifts | POST,GET | tenant-session | yes | yes |
| /api/sync-agent/download | GET | tenant proxy/session | download only | session-protected by proxy |
| /api/sync-agent/keys/:id | DELETE | tenant-session | yes | yes |
| /api/sync-agent/keys | POST,GET | tenant-session | yes | yes |
| /api/upload | POST,DELETE | tenant-session | yes | yes |
| /api/uploads/:...path | GET | tenant-session | path starts with org id | self/org |
| /api/v1/employees | GET | api-key | yes | permission key |
| /api/v1/keys | POST,GET,DELETE | session | yes | yes |
| /api/v1/leaves | GET | api-key | yes | permission key |
| /api/v1/organization | GET | api-key | yes | permission key |
| /api/v1/sync/heartbeat | POST | sync api-key | key row scoped | sync agent |
| /api/v1/sync/push | POST | sync api-key | yes | sync agent |
| /api/webhooks/stripe | POST | stripe-signature | subscription/org scoped | Stripe |

## Remaining Blockers Before Production GA

- RLS runtime model is not settled app-wide.
- Full cross-tenant automated tests are missing.
- Full manual UAT for every HR workflow is still needed on staging with real Coolify env/logs.
- Stripe webhook should be replay-tested with Stripe CLI/staging webhook secret.
- Upload route should be browser-tested with real file upload/delete against staging storage provider.
- Lint warnings should be reduced, especially `any`, React hook warnings, and notification navigation warning.
- Turbopack NFT trace warning should be investigated before production packaging.

## Beta/Staging Readiness Judgment

Safe to commit and push the current local fixes as beta/staging work after review.
Not production GA ready yet.
