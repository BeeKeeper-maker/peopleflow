# PeopleFlow Roadmap

_Last updated: 2026-06-01_

## North Star
Make PeopleFlow the default HR/office operations platform for Bangladeshi offices: secure, Bengali-first, multi-tenant, device-aware, and reliable enough to replace existing HR tools.

## Phase 0 — Stabilize Production
**Goal:** the latest code deploys reliably and stays healthy.

- Fix deployment fragility.
- Enforce lint/typecheck/test/build before release.
- Prove `/api/health`, DB, Redis, and worker health.
- Remove hidden build-risk from ignored type errors.

**Exit gate:** latest main branch deployed, health checks pass, smoke tests pass.

## Phase 1 — Controlled Office Pilot
**Goal:** safe first office handover.

- Organization onboarding/setup.
- Employee import/create/update flows.
- Leave request + approval workflow.
- ESS attendance and employee profile mapping.
- Device setup UX for LAN-only biometric realities.
- Bengali UX pass on critical screens.
- Role/permission verification.

**Exit gate:** pilot checklist passes with no demo blockers.

## Phase 2 — Security & Compliance Hardening
**Goal:** protect sensitive HR data and prove tenant isolation.

- Tenant isolation tests.
- RBAC tests for all roles.
- Rate limiting for auth and sensitive APIs.
- Audit logs for admin/payroll/leave/device/subscription actions.
- Backup/restore process and migration discipline.
- CSP hardening plan.

**Exit gate:** security QA report with P0/P1 findings fixed.

## Phase 3 — Operational Excellence
**Goal:** reliable daily office operations.

- Worker heartbeat and queue visibility.
- Retry/dead-letter policy clarity.
- Device sync audit trail and reconciliation flow.
- Usage tracking and subscription limit enforcement.
- Notification reliability.
- Support/admin diagnostics.

**Exit gate:** admins can diagnose common office issues without developer help.

## Phase 4 — Scale Architecture
**Goal:** ready for more tenants and larger load.

- Database index tuning for attendance/leave/payroll.
- Build server or registry-based deployment path.
- Observability: Sentry, logs, metrics, uptime alerts.
- Load/performance testing.
- Storage and file-upload policy hardening.
- Multi-branch reporting optimization.

**Exit gate:** documented capacity baseline and upgrade path.

## Phase 5 — Market Leadership
**Goal:** win on product quality, not just features.

- Premium UI/UX polish.
- Bangladesh payroll/compliance depth.
- Advanced reports and executive insights.
- Device vendor certification program.
- Migration tools from Excel/legacy systems.
- Public site, pricing, onboarding, demo flows.

**Exit gate:** PeopleFlow is demoable as a premium, enterprise-grade platform.

## Immediate next sprint
- Lock the release gate.
- Add tenant isolation tests.
- Audit auth/route helpers.
- Add queue visibility for worker ops.
- Polish Bengali-first office workflows.
