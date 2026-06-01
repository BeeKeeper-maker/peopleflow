# PeopleFlow Section Audit Tracker

_Last updated: 2026-06-01_

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
| Deployment & Infrastructure | In progress | P0 | Build/deploy recently unstable; worker/migration split incomplete | Design dedicated worker + migration release architecture |
| Auth & Sessions | Not audited | P0 | Security, credentials, role handling, tenant status enforcement | Full auth/RBAC code audit |
| Tenant Isolation | Not audited | P0 | Cross-tenant data leakage risk must be proven impossible | Add automated isolation tests |
| Platform Admin / SaaS Plans | Not audited | P1 | Plan limits/billing psychology may be incomplete | Audit plan enforcement and UI |
| Employee Management | Not audited | P1 | Core office workflow; data quality and import UX matter | Review CRUD, import, profile mapping |
| Leave Management | Partially improved | P1 | Approval workflow and Bengali table UX need QA | Browser QA + policy edge cases |
| Attendance | Partially improved | P1 | Future date handling fixed; device/sync edge cases remain | Audit attendance policy, shifts, reconciliation |
| Biometric Devices / Sync Agent | Partially improved | P1 | Must not overpromise universal device compatibility | Create Sync Agent readiness checklist |
| ESS Portal | Partially improved | P1 | Missing profile state improved; full ESS needs QA | Audit attendance/leave/doc flows |
| Payroll | Not audited | P1/P2 | High sensitivity; compliance and correctness critical | Delay major expansion until employee/attendance stable |
| Worker / Queues / Cron | Needs redesign | P0 | Web image split means worker deploy path must be explicit | Dedicated worker Docker target + health strategy |
| Notifications / Email | Not audited | P2 | Delivery reliability unknown | Audit SMTP, templates, retries |
| Reports / Analytics | Not audited | P2 | Performance and usefulness unknown | Competitor-informed reporting plan |
| Bengali UX / Design System | Not audited | P1 | Inconsistent translation/polish possible | Bengali copy audit + UI state review |
| Security Headers / CSP | Partially present | P1 | CSP may be permissive for compatibility | Review and harden gradually |
| Observability / Backups | Not audited | P0/P1 | Need alerts, logs, backup/restore | Define operations runbook |

## Immediate Audit Order
1. Deployment & Infrastructure
2. Worker / Queues / Migration release path
3. Auth / RBAC / Tenant Isolation
4. Core office workflows: Employee → Leave → Attendance → ESS
5. Bengali UX and design polish
6. Competitor matrix and product differentiation
