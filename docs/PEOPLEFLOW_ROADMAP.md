# PeopleFlow Roadmap

_Last updated: 2026-06-01_

## North Star
Make PeopleFlow the default HR/office operations platform for Bangladeshi offices: easy for small offices, powerful for multi-branch businesses, secure enough for sensitive HR/payroll data, and polished enough to replace existing tools.

## Phase 0 — Stabilize Production
**Goal:** latest code deploys reliably and core app remains healthy.

- Fix Docker/Coolify deploy instability.
- Verify app, worker, PostgreSQL, and Redis health.
- Add repeatable release checklist.
- Run lint/typecheck/test/build before every deploy.
- Confirm latest fixes are actually in production.

**Exit gate:** latest main branch deployed, `/api/health` healthy, smoke tests pass.

## Phase 1 — Controlled Office Pilot
**Goal:** safe first office handover.

- Tenant setup/onboarding flow.
- Employee import/create/update flows.
- Leave request + approval workflow.
- ESS attendance and employee profile mapping.
- Device setup UX for certified devices and LAN Sync Agent.
- Bengali UX pass across critical screens.
- Admin/user permission verification.

**Exit gate:** office pilot checklist passes with no demo blockers.

## Phase 2 — Security & Compliance Hardening
**Goal:** protect sensitive HR data and prove tenant isolation.

- Tenant isolation tests.
- RBAC tests for platform admin, tenant admin, manager, employee.
- Rate limiting for auth and sensitive APIs.
- Audit logs for admin, payroll, leave, device, subscription changes.
- Backup/restore process and production migration rules.
- CSP hardening plan.

**Exit gate:** security QA report with all P0/P1 findings fixed.

## Phase 3 — Operational Excellence
**Goal:** reliable daily office operation.

- Worker heartbeat and queue failure visibility.
- Retry/dead-letter policy for background jobs.
- Device sync audit trail and reconciliation flow.
- Usage tracking and subscription limit enforcement.
- Email/SMS notification reliability.
- Support/admin diagnostics dashboard.

**Exit gate:** admin can diagnose common office problems without developer intervention.

## Phase 4 — Scale Architecture
**Goal:** ready for many offices and larger infrastructure.

- Database indexes for high-volume attendance/leave/payroll queries.
- Build server or registry-based deployment.
- Observability: Sentry, structured logs, metrics, uptime alerts.
- Load/performance testing.
- Storage and file-upload policy.
- Multi-branch reporting optimization.

**Exit gate:** documented capacity baseline and upgrade path.

## Phase 5 — Market Leadership
**Goal:** win against existing HR tools in Bangladesh.

- Premium UI/UX polish and mobile-first ESS.
- Bangladesh payroll/compliance workflows.
- Advanced reports and executive insights.
- Device vendor certification program.
- Migration tools from Excel/legacy HR systems.
- Public website, pricing, onboarding, demo flows.

**Exit gate:** PeopleFlow can be confidently sold/demoed as a premium product.
