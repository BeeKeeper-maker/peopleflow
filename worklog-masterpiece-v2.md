# PeopleFlow Masterpiece v2 — Implementation Worklog

## Branch: `masterpiece-v2`
## Started: 2026-07-03
## Goal: Transform PeopleFlow from beta to industry-best HRMS masterpiece

---

## Phase 0 — Emergency Hotfixes ✅ COMPLETE (2026-07-03)

### Phase 0.1 — Biometric Data Flow Fix (10 hotfixes)
- ✅ Created canonical `src/lib/biometric/punch-processor.ts` (single source of truth)
- ✅ `attendance-ingest.ts` now re-exports from punch-processor (backward compat)
- ✅ `v1/sync/push/route.ts` delegates to canonical processor, fixes TZ skew
- ✅ `sync-engine.ts` delegates to canonical processor, adds sync_agent short-circuit
- ✅ `device-health.ts`: sync_agent devices use heartbeat health, not TCP ping
- ✅ `BiometricDevice.syncApiKeyId` field + migration (links device to API key)
- ✅ Manual sync route: enqueue BullMQ instead of inline (returns 202)
- ✅ `/iclock/*` endpoints now require per-device shared secret (HMAC auth)
- ✅ New `/api/biometric-devices/[id]/cloud-secret` endpoint (generate/revoke)
- ✅ Backfill RLS on BiometricCloudEvent and PlatformSupportIssue

### Phase 0.2 — Attendance Status Enum Fix (3 hotfixes)
- ✅ check-in route: `status="late"` → `status="present"` + `lateMinutes > 0`
- ✅ attendance-engine `VALID_STATUSES` aligned with schema
- ✅ submitRegularization: placeholder status `"pending"` → `"absent"`

### Phase 0.3 — Payroll Disbursement Unblock (5 hotfixes)
- ✅ New `POST /api/payroll/slips/[id]/approve` (draft → approved)
- ✅ New `POST /api/payroll/slips/[id]/pay` (approved|draft → paid)
- ✅ New `POST /api/payroll/slips/bulk-approve` (by IDs or by month/year)
- ✅ `process/route.ts`: accept `bonus/arrears/otherEarnings/otherDeductions`
- ✅ All new endpoints write audit log entries

### Sync Agent v1.2.0
- ✅ Recursive setTimeout (prevents overlapping sync cycles)
- ✅ Per-batch retry with exponential backoff (2s/4s/8s)
- ✅ File logger with rotation (`~/.peopleflow-sync-agent/agent.log`)
- ✅ 7-day TTL pruning on syncedKeys
- ✅ Handle `ALL_PUNCHES_UNMAPPED` response (don't mark as synced, retry)

### Phase 0 Verification
- ✅ TypeScript: clean (0 errors)
- ✅ Lint: 0 errors, 306 warnings (pre-existing)
- ✅ Tests: 291/291 passed
- ✅ Build: successful

---

## Phase 1.1 — Auth Foundation (partial) ✅ (2026-07-03)

- ✅ Remove `ignoreBuildErrors: true` from `next.config.ts`
- ✅ Add composite index on `Employee(organizationId, biometricUserId)`
- ✅ Bug #5: Approval engine cross-department manager scope fix
- ✅ Bug #6: Attendance regularization effect fix (now applies check-in/out)
- ✅ Bug #7: Shift form `crossesMidnight`, `code`, `nameBn` fields added
- ✅ Bug #14: Employee DELETE accepts `separationType` (resigned|terminated|retired)
- ✅ Bug #20: Announcements `targetDepartments` filter enforced for non-HR roles

### Verification
- ✅ TypeScript: clean
- ✅ Tests: 291/291 passed

---

## Phase 1.1 — Remaining (in progress)

- [ ] 2FA recovery codes + backup codes
- [ ] SMTP real test (Brevo/SendGrid) staging verification
- [ ] CSP hardening — nonce-based CSP
- [ ] 47 `as any` cleanup
- [ ] 48 API routes centralize to `requireAuth/requireRole`
- [ ] Tenant isolation test suite
- [ ] RLS runtime integration audit

---

## Next: Phase 1.2 — Critical Module Fixes
- [ ] Attendance: Manual entry API + UI
- [ ] Attendance: Missed punch alert worker
- [ ] Attendance: Overtime approval workflow
- [ ] Leave: Encashment execution (EncashmentRequest model + workflow)
- [ ] Leave: Comp-off (compensatory leave) workflow
- [ ] Leave: Carry-forward admin UI + scheduled job
- [ ] Leave: Maternity tracking UI
- [ ] Payroll: Lock period + unlock API
- [ ] Payroll: Reversal API with audit trail
- [ ] Payroll: Bulk re-process with confirmation
- [ ] Payroll: Bank-wise disbursement file
