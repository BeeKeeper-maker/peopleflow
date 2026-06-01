# PeopleFlow Enterprise Audit

_Last updated: 2026-06-01_

## 1) Current architecture summary
- **Frontend:** Next.js 16 App Router, React 19, Tailwind CSS v4, next-intl, shadcn-style component stack.
- **Auth:** Dual-plane Auth.js v5 setup: tenant auth in `src/lib/auth.ts`, platform-admin auth in `src/lib/platform-auth.ts`.
- **Data:** Prisma + PostgreSQL multi-tenant schema with tenant data on `Organization`/`User`/`Employee` and platform data on `PlatformAdmin`.
- **Infra:** Redis + BullMQ workers, Docker/Coolify deployment, separate worker process, standalone Next output.
- **Domain coverage:** HR core, payroll, attendance, leave, approvals, recruitment, expense claims, document requests, biometric sync, notifications, usage tracking.
- **Localization:** Bengali + English message bundles exist (`messages/bn.json`, `messages/en.json`), but coverage is uneven.

## 2) Critical risks / blockers before office handover
1. **Build safety is weakened by `ignoreBuildErrors: true`.**
   - This hides TypeScript regressions during production builds.
   - Current repo still contains many loose types (`49` `as any` hits, `89` `any`-style hits from grep).
2. **Tenant isolation is not yet proven by tests.**
   - `withTenant()` / `withPlatform()` are good patterns, but I did not find an enforced test suite proving cross-tenant reads/writes are impossible.
3. **Route-level authorization is inconsistent.**
   - Some API routes gate with `auth()`, some appear to rely on path-level protection, and some platform/tenant flows are handled differently.
4. **Office-pilot UX is not yet deterministic.**
   - Core workflows need a strict handover checklist: employee setup, leave approval, attendance, payroll, device sync, Bengali copy.
5. **Operational visibility is incomplete.**
   - Workers exist, but there is no obvious queue dashboard, DLQ triage surface, or worker heartbeat UI.

## 3) Deployment/build pipeline issues + target architecture
### Observed issues
- `next.config.ts` suppresses build-time TS errors.
- Docker app + worker share the same build context, which is fine early on but increases deploy cost.
- Current flow appears VPS/Coolify-first, with no documented CI release gate.
- Lightweight lint check could not complete here because local dependencies were not installed; `npx eslint` attempted a fetch and failed against the local config environment.

### Recommended target architecture
- **Required release gate:** `npm run lint` → `npx tsc --noEmit` → `npm run test` → `npm run build`.
- **Production build policy:** no ignored TS errors in release branch.
- **Runtime split:** app container, worker container, PostgreSQL, Redis, optional cron/queue monitor.
- **Later optimization:** separate worker image or registry-based deploys when office load grows.
- **Ops checks:** `/api/health`, DB connectivity, Redis connectivity, worker heartbeat, queue backlog.

## 4) Security / RBAC / multi-tenant isolation concerns
- `withPlatform()` is the right cross-tenant escape hatch, but it must be rare, logged, and test-covered.
- Platform auth and tenant auth are separate, but some shared helpers still use `as any` in auth callbacks and audit logging.
- `src/proxy.ts` is doing path-based gating; that is not enough alone for sensitive APIs.
- Ensure every write path validates:
  - authenticated session
  - organization membership
  - role/permission
  - module entitlement
  - object ownership / tenant scope
- Add tests for:
  - cross-org employee fetch/update rejection
  - platform-only route denial for tenant users
  - impersonation expiry and cleanup
  - API-key scoped access
- CSP is present, but still relies on `unsafe-inline` / `unsafe-eval` compatibility allowances.

## 5) DB / schema / index / performance concerns
- Schema is broad and ambitious: org, HR, payroll, approval workflow, device sync, platform SaaS, sales lead capture.
- Strong starting indexes exist on many core tables, but I would review hot paths for:
  - `organizationId + date/status`
  - `organizationId + employeeId`
  - `employeeId + month/year`
  - approval queues and audit logs
  - device sync logs / health logs
- Likely hot tables under load:
  - `Attendance`
  - `LeaveApplication`
  - `AuditLog`
  - `DeviceSyncLog` / `DeviceHealthLog`
  - `ApprovalRequest` / `ApprovalStepLog`
- Query plan review is needed for dashboard aggregates, attendance reconciliation, payroll generation, and bulk employee views.
- Consider future partitioning/archival for audit and device logs if tenant count grows.

## 6) UI/UX / Bengali / local office workflow gaps
- Marketing landing page is polished, but still heavily English-first.
- Bengali is present in translations and schema fields, but the product needs a verified Bengali-first admin/ESS pass.
- Critical office workflows need clearer UX:
  - setup organization
  - add branches/departments/designations
  - import employees
  - map biometric IDs
  - configure attendance and leave policies
  - approve leave / expenses / loans
  - run payroll
- Add stronger empty/loading/error states everywhere, especially tables and list views.
- Make device setup explicit for Bangladesh reality:
  - LAN-only biometric devices
  - branch office connectivity issues
  - sync-agent setup and troubleshooting
- Reduce jargon in admin copy; keep terms consistent across English/Bengali.

## 7) Worker / queue / cron / device-sync assessment
- Good architectural choice: worker process is separated and BullMQ-backed.
- Coverage includes notifications, subscription lifecycle, impersonation cleanup, usage tracking, biometric sync, device health, and attendance reconciliation.
- Strengths:
  - clear queue registry
  - retry policies
  - scheduled jobs
  - reconciliation safety net for missing attendance
- Gaps:
  - no obvious queue admin UI / operational dashboard
  - no visible dead-letter inspection workflow
  - no obvious worker heartbeat SLA surface
  - biometric device sync still needs proven idempotency and auditability
- Recommendation: keep LAN biometric support via sync agent first; do not promise universal direct-cloud device compatibility.

## 8) Prioritized roadmap
### P0 — Stabilize
- Restore strict build/type safety.
- Prove tenant isolation.
- Make deploys deterministic.
- Smoke-test auth, dashboard, leave, attendance, payroll, and device sync.

### P1 — Office pilot
- Bengali-first pilot UX.
- Employee onboarding/import.
- Leave/attendance/approval workflows.
- Device setup + sync agent onboarding.
- Role/permission verification.

### P2 — Scale
- Performance/index tuning.
- Queue observability and DLQ triage.
- CI/CD hardening.
- Backup/restore drills.
- Metrics/alerts.

### P3 — Market leadership
- Bangladesh compliance depth.
- Executive analytics.
- Migration tooling from Excel/legacy systems.
- Premium mobile-first ESS and support tooling.

## 9) Specific next implementation tasks + verification gates
1. **Build gate hardening**
   - Task: remove the hidden TS escape hatch and enforce CI typecheck.
   - Gate: `npx tsc --noEmit` and `npm run build` must pass.
2. **Tenant isolation test suite**
   - Task: add cross-org read/write denial tests for the main HR models.
   - Gate: automated tests for employee, leave, attendance, approval, and device access.
3. **RBAC/entitlement audit**
   - Task: normalize route/API authorization helpers.
   - Gate: tests for tenant admin / manager / employee / platform-admin access.
4. **Deployment reliability**
   - Task: document a reproducible release process for Coolify.
   - Gate: repeatable deploy + `/api/health` + worker heartbeat.
5. **Bengali office workflow pass**
   - Task: review top user journeys for copy, validation, and empty states.
   - Gate: pilot checklist signed off on the main HR flows.
6. **Worker operations**
   - Task: add operational visibility for queues and failed jobs.
   - Gate: ability to inspect backlog, failures, and retry outcomes without SSH spelunking.
