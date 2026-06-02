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
| Deployment & Infrastructure | Stabilized, monitor | P0 | Web + worker now healthy; migration release job still needs explicit production-safe procedure | Document/test migration release gate and backup rule |
| Auth & Sessions | Not audited | P0 | Security, credentials, role handling, tenant status enforcement | Full auth/RBAC code audit |
| Tenant Isolation | Not audited | P0 | Cross-tenant data leakage risk must be proven impossible | Add automated isolation tests |
| Platform Admin / SaaS Plans | Not audited | P1 | Plan limits/billing psychology may be incomplete | Audit plan enforcement and UI |
| Employee Management | Not audited | P1 | Core office workflow; data quality and import UX matter | Review CRUD, import, profile mapping |
| Leave Management | Partially improved | P1 | Approval workflow and Bengali table UX need QA | Browser QA + policy edge cases |
| Attendance | Partially improved | P1 | Future date handling fixed; device/sync edge cases remain | Audit attendance policy, shifts, reconciliation |
| Biometric Devices / Sync Agent | Partially improved | P1 | Must not overpromise universal device compatibility | Create Sync Agent readiness checklist |
| ESS Portal | Partially improved | P1 | Missing profile state improved; full ESS needs QA | Audit attendance/leave/doc flows |
| Payroll | Not audited | P1/P2 | High sensitivity; compliance and correctness critical | Delay major expansion until employee/attendance stable |
| Worker / Queues / Cron | Partially stabilized | P0 | Worker deploy now succeeds, but queue observability and migration/release job gate remain incomplete | Add worker/queue health visibility and failed-job review path |
| Notifications / Email | Not audited | P2 | Delivery reliability unknown | Audit SMTP, templates, retries |
| Reports / Analytics | Not audited | P2 | Performance and usefulness unknown | Competitor-informed reporting plan |
| Bengali UX / Design System | Initial issues found | P1 | Bengali mode still mixes English labels and English date/day formatting on office-critical screens | Run Bengali copy audit for Dashboard, Employees, Devices, ESS Attendance |
| Security Headers / CSP | Partially present | P1 | CSP may be permissive for compatibility | Review and harden gradually |
| Observability / Backups | Not audited | P0/P1 | Need alerts, logs, backup/restore | Define operations runbook |

## Immediate Audit Order
1. Migration release path + backup rule
2. Worker / Queues observability and failed-job visibility
3. Auth / RBAC / Tenant Isolation
4. Core office workflows: Employee → Leave → Attendance → ESS
5. Bengali UX and design polish
6. Competitor matrix and product differentiation

## Latest Audit Notes — 2026-06-02

- Deployment: web app, DB, Redis, and worker are currently healthy in Coolify.
- Worker: deploy `df8ccmmz2zzf084ixd5bvv7w` finished successfully at commit `94b1a3f`; Docker healthcheck passed; worker logs show all 7 workers registered and recurring jobs processing.
- Local quality gates: lint passed with warnings, typecheck passed, build passed, unit tests passed.
- Browser smoke: dashboard, employees, leave requests, attendance, devices, ESS attendance loaded successfully.
- Product/polish findings: employee directory still has English headings/cards in Bengali mode; biometric devices page has mixed English/Bengali guidance headings; ESS attendance uses English weekday/date strings; current day absent behavior needs policy review before office demo.
- Infra watch item: `/api/health` reports memory warning while server/database/redis are healthy.
