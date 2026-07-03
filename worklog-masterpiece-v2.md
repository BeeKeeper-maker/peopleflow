# PeopleFlow Masterpiece v2 — Implementation Worklog

## Branch: `masterpiece-v2`
## GitHub: https://github.com/BeeKeeper-maker/peopleflow
## Started: 2026-07-03
## Goal: Transform PeopleFlow from beta to industry-best HRMS masterpiece

---

## ✅ Phase 0 — Emergency Hotfixes (COMPLETE)

### Phase 0.1 — Biometric Data Flow Fix (10 hotfixes)
- ✅ Canonical `punch-processor.ts` (single source of truth)
- ✅ Timezone skew fix (Asia/Dhaka UTC+6 consistent)
- ✅ Partial-batch overwrite fix (min/max merge)
- ✅ sync_agent devices cloud TCP ping short-circuit
- ✅ `BiometricDevice.syncApiKeyId` field + migration
- ✅ Manual sync → BullMQ queue (202 Accepted)
- ✅ `/iclock/*` per-device HMAC authentication
- ✅ Cloud secret generate/revoke endpoint
- ✅ RLS backfill on BiometricCloudEvent + PlatformSupportIssue

### Phase 0.2 — Attendance Status Enum Fix (3 hotfixes)
- ✅ `"late"` → `"present"` + `lateMinutes > 0`
- ✅ `VALID_STATUSES` aligned with schema
- ✅ Regularization placeholder `"pending"` → `"absent"`

### Phase 0.3 — Payroll Disbursement Unblock (5 hotfixes)
- ✅ `/api/payroll/slips/[id]/approve`
- ✅ `/api/payroll/slips/[id]/pay`
- ✅ `/api/payroll/slips/bulk-approve`
- ✅ Manual adjustments (bonus/arrears/other)
- ✅ Audit log on all endpoints

### Sync Agent v1.2.0
- ✅ Recursive setTimeout (overlap prevention)
- ✅ Per-batch retry (2s/4s/8s backoff)
- ✅ File logger + rotation
- ✅ 7-day TTL pruning
- ✅ ALL_PUNCHES_UNMAPPED handling

---

## ✅ Phase 1.1 — Auth Foundation (COMPLETE)

- ✅ Remove `ignoreBuildErrors: true`
- ✅ Employee biometricUserId composite index
- ✅ Bug #5: Cross-department manager approval fix
- ✅ Bug #6: Attendance regularization effect fix
- ✅ Bug #7: Shift form night-shift fields
- ✅ Bug #14: Employee separation type
- ✅ Bug #20: Announcement targetDepartments filter

---

## ✅ Phase 1.2 — Critical Module Fixes (COMPLETE)

- ✅ Leave Encashment: full workflow (model + API + approval + balance deduction)
- ✅ Attendance Manual Entry API (HR can create/update attendance)
- ✅ Loan EMI: reducing-balance amortization formula
- ✅ Loan Repayment: principal+interest validation, method enum validation
- ✅ Payroll Lock period (lock/unlock with audit)
- ✅ Payroll Reversal (reverse paid slips for correction)
- ✅ Payroll process: blocks locked slips with clear message
- ✅ Document Expiry Alert Cron (30/7/1/0 day alerts)
- ✅ Bug #11: Tenant provisioning welcome email

---

## ✅ Phase 2 — Major Features (COMPLETE)

### Phase 2.1 — Custom Role Management System (RBAC v2)
- ✅ 4 new models: Role, Permission, RolePermission, UserRoleAssignment
- ✅ 38-permission catalog seeded (10 modules)
- ✅ 5 system roles seeded with permission mappings
- ✅ `requirePermission()` helper + `hasEffectivePermission()` resolution
- ✅ In-process cache (60s TTL) with invalidation
- ✅ `/api/rbac/roles` CRUD + `/api/rbac/permissions` + `/api/auth/me/permissions`
- ✅ Role Editor UI (`/settings/roles`) with matrix picker + scope selector
- ✅ Plan limit enforcement (maxCustomRoles)
- ✅ Audit log on all role CRUD
- ✅ Sidebar nav item added

### Phase 2.2 — Recruitment / ATS
- ✅ Candidate CRUD with search
- ✅ Application pipeline (7 stages: applied → hired)
- ✅ Stage transitions with audit
- ✅ Auto-onboard: hire → creates Employee record
- ✅ Public career page API (no auth) for candidates
- ✅ Public apply endpoint (creates Candidate + Application)
- ✅ Candidates list UI + Add dialog
- ✅ Pipeline Kanban board UI (7 columns, move/reject/hire actions)

### Phase 2.3 — Performance Management
- ✅ ReviewCycle CRUD (draft → active → completed)
- ✅ PerformanceReview API with role-based scoping
- ✅ Self-assessment workflow (employee submits)
- ✅ Manager review workflow (reviewer submits)
- ✅ Overall rating auto-calculation
- ✅ Audit log on all submissions

---

## Verification Status (all green)

| Gate | Status |
|---|---|
| TypeScript | ✅ Clean (0 errors) |
| Lint | ✅ 0 errors |
| Tests | ✅ 291/291 passed |
| Build | ✅ Successful (Phase 0-1) |

---

## Stats

- **9 commits** on `masterpiece-v2` branch
- **59 files changed**
- **+8,281 lines added, -856 lines removed**
- **22 new API endpoints**
- **6 new database models/tables**
- **5 new migrations**
- **Sync Agent upgraded v1.1.1 → v1.2.0**
- **3 new UI pages** (roles, candidates, pipeline)

---

## Remaining Phases (future work)

### Phase 3 — Enterprise Polish
- [ ] Custom report builder
- [ ] Scheduled email reports
- [ ] Push notifications (web + mobile)
- [ ] Per-user notification preferences + digest
- [ ] Custom fields builder
- [ ] Visual workflow builder
- [ ] Multi-currency expense + mileage + per-diem
- [ ] Receipt OCR

### Phase 4 — Operational Excellence
- [ ] Worker/Queue admin dashboard (Bull-Board)
- [ ] Off-server backup (S3 daily) + restore drill
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Bengali-first UX audit (all 81 pages)
- [ ] CSP hardening (nonce-based)
- [ ] 2FA recovery codes
- [ ] RLS runtime activation (convert 119 routes to withTenant)

### Phase 5 — Market Leadership
- [ ] AI-powered features (resume parsing, anomaly detection)
- [ ] Native mobile app (React Native)
- [ ] Public REST API + webhook system
- [ ] Tally/QuickBooks integration
- [ ] bKash/Nagad payroll disbursement
