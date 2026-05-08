# PeopleFlow / HR Project — Office Function Audit

Date: 2026-05-08
Focus: real office/client workflow readiness, not security-only hardening.

## Current verdict

The application has strong feature breadth, but several high-visibility HR workflows have UI/API contract bugs. These are the kind of bugs that can embarrass the product in a client demo because buttons/pages exist but fail or show wrong/empty data.

Do **not** demo as a polished office-ready product until the P0/P1 issues below are fixed and role-based UAT is rerun.

## Verification status

- Existing E2E suite passes when pointed at the correct HR app server (`http://localhost:3100`), but those tests do not cover many office workflows below.
- PostgreSQL service was started locally and accepts connections, but current `DATABASE_URL` user was denied access, so this pass is primarily static code + UI/API contract verification.
- Security findings are tracked separately in `SENIOR_AUDIT_NOTES_2026-05-08.md`.

---

## P0 — Demo-breaking / core workflow failures

### 1. ESS expense submission calls a non-existent/wrong API

**User-facing impact:** Employee clicks “New Expense Claim”, fills form, submits — likely fails. This is a direct office workflow failure.

**Evidence:**
- UI: `src/app/(ess)/ess/expenses/new/page.tsx:116-124`
  - Sends `FormData` to `POST /api/expenses`
  - Uses fields: `category`, `date`, status `pending`
- Backend: `src/app/api/expenses/claims/route.ts:12-17`
  - Real endpoint is `/api/expenses/claims`
  - Expects JSON, not `FormData`
  - Expects `categoryId`, `expenseDate`, status `draft|submitted`

**Fix:** Change ESS expense form to JSON POST `/api/expenses/claims` with `categoryId`, `expenseDate`, numeric `amount`, and `status: submitted` when submitted.

---

### 2. ESS expense list calls wrong endpoint

**User-facing impact:** Employee opens “My Expenses” and sees no data/error even if claims exist.

**Evidence:**
- UI: `src/app/(ess)/ess/expenses/page.tsx` calls `/api/expenses`
- Backend route exists at `/api/expenses/claims`

**Fix:** Update ESS expenses list to fetch `/api/expenses/claims` and normalize the array response.

---

### 3. Manager expense approvals call wrong endpoint and wrong status model

**User-facing impact:** Manager dashboard approval screen will not show/approve submitted expense claims correctly.

**Evidence:**
- UI: `src/app/(manager)/manager/approvals/page.tsx:76,96,132`
  - Fetches `/api/expenses?status=pending`
  - Approves/rejects `/api/expenses/${id}`
- Backend:
  - Real route is `/api/expenses/claims` and `/api/expenses/claims/[id]`
  - Pending-for-approval is represented as `submitted`, not `pending` (`pending=true` helper exists)

**Fix:** Use `/api/expenses/claims?pending=true`; actions should call `/api/expenses/claims/${id}` with `{ action: "approve" | "reject", rejectionReason? }`.

---

### 4. ESS payslips page calls non-existent endpoint

**User-facing impact:** Employee cannot view salary slips from ESS. Payroll transparency workflow breaks.

**Evidence:**
- UI: `src/app/(ess)/ess/payslips/page.tsx:48` fetches `/api/payslips`
- Backend: route is `src/app/api/payroll/payslips/route.ts`

**Fix:** Change ESS payslips fetch to `/api/payroll/payslips` and normalize response.

---

### 5. Payroll dashboard likely crashes after loading slips

**User-facing impact:** HR/Admin opens Payroll page; once data loads, page can break because `slips` becomes an object, not array.

**Evidence:**
- UI: `src/app/(dashboard)/payroll/page.tsx:111` does `setSlips(await slipsRes.json())`
- API: `src/app/api/payroll/process/route.ts:68` returns `{ data: slips, pagination: ... }`
- UI later uses `slips.reduce`, `slips.filter`, `slips.map` at `src/app/(dashboard)/payroll/page.tsx:157-160,479`

**Fix:** `const data = await slipsRes.json(); setSlips(data.data || data || [])`.

---

### 6. Attendance monthly/team pages use query params that API ignores

**User-facing impact:** Manager/ESS attendance reports show wrong or empty monthly/team numbers. This damages trust because attendance is one of the most important HR functions.

**Evidence:**
- API: `src/app/api/attendance/route.ts:13-48`
  - Reads only `limit` and `employeeId`
  - Ignores `date`, `year`, `month`, `startDate`
  - For normal users returns only own last records; for manager without employeeId it returns manager’s own attendance, not team attendance
- UI callers:
  - `src/app/(manager)/manager/attendance/page.tsx:55` calls `/api/attendance?year=...&month=...`
  - `src/app/(manager)/manager/dashboard/page.tsx` calls `/api/attendance?date=today`
  - `src/app/(ess)/ess/attendance/page.tsx:60` calls `/api/attendance?year=...&month=...`

**Fix:** Add proper filters to `/api/attendance` or create dedicated report endpoints. Manager pages should only show reporting-manager team data, not all employees.

---

### 7. Attendance field/status mismatch causes wrong stats

**User-facing impact:** Attendance page may show everyone absent/not checked in or zero present even with records.

**Evidence:**
- Backend attendance records use fields like `checkIn`, `checkOut`, `status: "present" | "late"` from `src/app/api/attendance/check-in/route.ts`.
- ESS attendance page expects `checkInTime`, `checkOutTime`, `totalMinutes` in `src/app/(ess)/ess/attendance/page.tsx:76-90`.
- Manager attendance compares uppercase status (`PRESENT`, `LATE`) in `src/app/(manager)/manager/attendance/page.tsx:68,72,106` while backend writes lowercase.

**Fix:** Standardize attendance API response DTO or update UI to use real fields/status casing.

---

### 8. Dashboard expense admin page receives array but expects `data.claims`

**User-facing impact:** Admin Expense Claims page can show empty list even when claims exist.

**Evidence:**
- API: `src/app/api/expenses/claims/route.ts:131` returns `NextResponse.json(claims)` as an array.
- UI: `src/app/(dashboard)/expenses/page.tsx:95,98` reads `data.claims || []`.

**Fix:** Either return `{ claims }` from API or update UI to `const allClaims = Array.isArray(data) ? data : data.claims || []`.

---

## P1 — High reputation risk / misleading office data

### 9. Expense category object rendered as string

**Impact:** Once expense claims are shown, UI can render `[object Object]` or throw when searching.

**Evidence:**
- API includes `category: true` object (`src/app/api/expenses/claims/route.ts:111`).
- UI types category as string and calls `c.category.toLowerCase()` (`src/app/(dashboard)/expenses/page.tsx:38,147`) and renders `{claim.category}` (`line 295`).

**Fix:** Use `claim.category?.name` everywhere.

---

### 10. ESS half-day leave uses wrong field name

**Impact:** Employee selects half-day, but backend may treat it as full-day because UI sends `isHalfDay`; backend reads `halfDay`.

**Evidence:**
- UI: `src/app/(ess)/ess/leaves/apply/page.tsx:123` sends `isHalfDay`.
- API: `src/app/api/leaves/applications/route.ts:125,226,299` reads and stores `halfDay`.

**Fix:** Send `halfDay: formData.isHalfDay`.

---

### 11. Leave balance shown in ESS apply page is likely undefined/misleading

**Impact:** Employee sees confusing leave balance text when choosing leave type.

**Evidence:**
- ESS apply page expects `remainingDays` from `/api/leaves/types`.
- `/api/leaves/types` returns raw leave type records, not per-employee balance.
- Correct balance source appears to be `/api/leaves/allocations`.

**Fix:** Use allocations endpoint for employee leave balances or enrich leave-types response for ESS.

---

### 12. Reports attendance export calls missing endpoint

**Impact:** Admin clicks Attendance Export and it fails.

**Evidence:**
- UI: `src/app/(dashboard)/reports/page.tsx:110` calls `/api/attendance/reports?month=...&year=...`
- Existing report route is `/api/reports/attendance`.

**Fix:** Update export to `/api/reports/attendance` or implement `/api/attendance/reports`.

---

### 13. Manager dashboard/team uses all employees, not manager’s team

**Impact:** A manager may see company-wide employees instead of direct reportees; bad for privacy and office hierarchy correctness.

**Evidence:**
- Manager pages call `/api/employees` directly and then slice/map results.
- Need verify `/api/employees` role filtering; if not manager-scoped, this is a serious office workflow issue.

**Fix:** Add `/api/manager/team` or role-scope `/api/employees` for managers to `reportingManagerId = current employee.id`.

---

## P2 — Incomplete polish / not demo-first

### 14. Settings has coming-soon controls

**Impact:** Not fatal, but looks unfinished in a client demo.

**Evidence:** `src/app/(dashboard)/settings/page.tsx:647,654` has `comingSoon` badges.

**Fix:** Hide unfinished controls from beta demos or mark as roadmap outside core flow.

### 15. Billing storage usage is placeholder

**Impact:** Tenant billing/limits can look inaccurate.

**Evidence:** `src/app/api/billing/status/route.ts:99` storage usage returns TODO/0.

**Fix:** Implement storage usage or remove storage quota display until ready.

### 16. S3 storage provider is not implemented

**Impact:** If production env selects S3, uploads fail.

**Evidence:** `src/lib/storage.ts:191-204` throws “S3 upload/delete/signed URL not implemented”.

**Fix:** Keep local storage only in env, or implement S3 before enabling it.

---

## Recommended immediate fix order

1. Fix all endpoint mismatches: expenses, payslips, reports.
2. Normalize response contracts: arrays vs `{ data }`, expense category object, payroll slips object.
3. Fix attendance API filters/DTO and manager team scoping.
4. Fix ESS half-day leave field.
5. Add office-workflow E2E tests:
   - Employee submits expense → manager approves → admin sees approved claim.
   - Employee applies half-day leave → manager approves → balance and attendance update.
   - Admin runs payroll → employee sees payslip.
   - Employee check-in/out → ESS monthly attendance and manager team dashboard show correct status.
   - Reports export attendance/payroll without error.
6. Rerun: lint, typecheck, unit tests, build, Playwright role-based UAT.

## Practical demo verdict

- **Safe to demo:** marketing/public pages, basic login, broad dashboard navigation, employee directory if seeded correctly.
- **Do not demo yet:** ESS expenses, manager approvals for expenses, ESS payslips, payroll dashboard, attendance monthly/team reporting, attendance export.
- **Office-ready after fixes:** likely yes, because the backend feature set is broad; the main problem is inconsistent UI/API contracts and missing role-based workflow tests.

---

## Stabilization Pass 1 — 2026-05-08

Status: implemented and verified with lint, TypeScript, unit tests, and production build.

### Fixed in this pass

1. ESS expense creation now posts to `/api/expenses/claims` with the backend contract:
   - JSON body
   - `categoryId`, `expenseDate`, numeric `amount`
   - `status: draft|submitted`
   - receipt upload handled through `/api/upload` before claim creation

2. ESS expense list now reads `/api/expenses/claims`, supports array/data/claims shapes, maps `submitted` as pending, and displays category object names.

3. Manager expense approvals now use:
   - List: `/api/expenses/claims?pending=true`
   - Approve/reject: `PATCH /api/expenses/claims/[id]` with `action: approve|reject`

4. Manager leave approvals now use `PUT /api/leaves/applications/[id]`, matching the backend route.

5. ESS payslips now fetch `/api/payroll/payslips`.

6. Payroll dashboard now normalizes `{ data }` responses before using `reduce/filter/map`.

7. Attendance API now supports `date`, `year`, `month`, `employeeId`, org-scoped privileged views, and DTO aliases:
   - `checkInTime`
   - `checkOutTime`
   - `totalMinutes`

8. Manager attendance status checks now handle lowercase backend statuses (`present`, `late`, `on_leave`).

9. ESS half-day leave now sends `halfDay`, matching backend storage.

10. Reports export now uses `/api/reports/attendance` and normalizes payroll `{ data }` responses.

11. Admin expenses page now handles array/data/claims responses, `submitted` pending status, category objects, and correct `PATCH` approval method.

### Verification

- `npm run lint` — passed with existing warnings only.
- `npx tsc --noEmit` — passed.
- `npm test` — 265 tests passed.
- `npm run build` — passed.

### Remaining after Pass 1

- Role-based runtime UAT still needed with a working local/staging database login.
- Manager team scoping needs deeper verification: current attendance API is org-scoped for privileged users; ideal business rule is manager direct-report scoping.
- Leave balance display in ESS apply page still needs allocation-backed balance refinement.
- Security findings remain tracked separately in `SENIOR_AUDIT_NOTES_2026-05-08.md`.

---

## Stabilization Pass 2 — 2026-05-08

Status: implemented and verified with TypeScript, unit tests, and production build.

### Fixed in this pass

1. Added `/api/manager/team` for manager portal team lists:
   - Manager users see only direct reportees (`reportingManagerId = current employee`).
   - Admin/HR using the route can still see active org employees.

2. Updated manager pages to use manager-scoped team data instead of `/api/employees`:
   - `/manager/dashboard`
   - `/manager/team`
   - `/manager/attendance`

3. Attendance API manager scoping tightened:
   - A manager without `employeeId` now receives attendance only for direct reportees.
   - A manager with `employeeId` can only request attendance for a direct reportee.

4. Leave application listing tightened for manager views:
   - Managers see only direct reportees' leave applications.
   - `year` + `month` filters now work for manager team leave pages.

5. Manager team leaves page fixed date field mapping:
   - Uses backend `fromDate`/`toDate` instead of non-existent `startDate`/`endDate`.

6. ESS leave apply page now loads leave balances from `/api/leaves/allocations`, not raw `/api/leaves/types`:
   - Remaining balance shown in the dropdown is now allocation-backed.

### Verification

- `npx tsc --noEmit` — passed.
- `npm test` — 265 tests passed.
- `npm run build` — passed.

### Remaining after Pass 2

- Runtime UAT with seeded users is still required to confirm role behavior end-to-end in browser.
- Add Playwright regression tests for manager/direct-report scoping and leave/expense/payroll workflows.
- Decide business behavior for admin/HR using manager portal routes: currently admin/HR can see active org employees through `/api/manager/team`.

---

## Stabilization Pass 3 — 2026-05-08

Status: implemented and verified with lint, TypeScript, unit tests, and production build.

### Employee mobile/PWA improvements

1. Login redirect is now role-aware after successful sign-in:
   - employee → `/ess/dashboard`
   - manager → `/manager/dashboard`
   - admin/hr/super_admin → `/dashboard`

2. ESS layout is more mobile-friendly:
   - Mobile content padding reduced from desktop-heavy `p-6` to `px-4 py-4`.
   - Added mobile bottom navigation for the employee portal:
     - Home
     - Time
     - Leave
     - Pay
     - Profile
   - Bottom safe-area padding added for phone browser/PWA use.

3. Employee dashboard has mobile install guidance:
   - Added mobile “PeopleFlow mobile app” install CTA.
   - Uses the PWA install prompt when available.
   - Falls back to Add to Home Screen guidance when browser prompt is unavailable.

4. PWA install hook improved:
   - `useInstallPrompt()` now exposes `canInstall`.
   - Emits install availability/installed events so UI can react.

5. Attendance API now supports `startDate`/`endDate`, fixing employee dashboard monthly attendance summary calls.

### Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265 tests passed.
- `npm run build` — passed.

### Remaining mobile-first work

- Browser visual QA at mobile widths for all ESS pages:
  - dashboard
  - attendance
  - leaves/apply
  - expenses/new
  - payslips
  - documents
  - profile
- Add Playwright mobile viewport checks for ESS critical flows.
- Review Bengali copy and touch-target sizes on employee mobile screens.
- Consider a true `/employee/login` alias later if client onboarding needs a simpler QR/link for staff.

---

## Stabilization Pass 4 — 2026-05-08

Status: implemented and verified.

### Mobile regression protection added

1. Added mobile ESS Playwright regression coverage:
   - Employee login lands on `/ess/dashboard`.
   - Employee dashboard shows the mobile app install CTA.
   - Employee bottom navigation is visible on phone width.
   - Bottom nav opens critical ESS pages:
     - Attendance
     - Leaves
     - Payslips
     - Profile
   - Checks for horizontal overflow at phone width.

2. Tightened authenticated auth redirect behavior:
   - Logged-in users visiting `/login` or `/register` are redirected to their correct role home.
   - Employee users attempting `/dashboard` are redirected back to `/ess/dashboard`.

3. Improved ESS bottom navigation accessibility:
   - Added explicit `aria-label="Employee quick actions"` for reliable assistive-tech and test targeting.

4. Fixed PWA install event consistency:
   - Service worker registration now dispatches PeopleFlow install availability/installed events.
   - Dashboard install UI and PWA registration now use the same event contract.

### Verification

- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265 tests passed.
- `npm run build` — passed with existing Turbopack NFT warnings.
- Mobile ESS Playwright smoke — 3/3 passed.
- Desktop E2E regression pack — 24/24 passed, including the new ESS checks.

### Notes

- A disposable local test database was used for browser verification:
  - `peopleflow_mobile_e2e`
- No production/staging database was modified.
- The next practical lane is deeper role workflow regression:
  - employee expense submit → manager approve → admin sees approved
  - employee leave apply → manager approve → balance impact
  - payroll process → employee payslip visibility
  - manager cannot see non-reportees

---

## Stabilization Pass 5 — 2026-05-08

Status: implemented and verified.

### Manager privacy / IDOR hardening

1. Expense claim detail and approval routes are now manager-scoped:
   - Employee can access only own claims.
   - Manager can access/approve only direct reportees' claims.
   - Admin/HR/super_admin can access organization-level claims.
   - Non-reporting manager access now returns not found/forbidden instead of leaking claim data.

2. Leave application detail and approval routes are now manager-scoped:
   - Employee can access only own leave application detail.
   - Manager can access/approve only direct reportees' leave applications.
   - Admin/HR/super_admin retain organization-level authority.
   - Non-reporting manager access now returns not found/forbidden instead of leaking leave data.

3. Added regression tests:
   - Non-reporting manager cannot inspect or approve another employee expense claim.
   - Non-reporting manager cannot inspect or approve another employee leave application.
   - Admin can still inspect the same records.

### Verification

- Full E2E regression pack: 26/26 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warnings.
- `git diff --check` — passed.

### Business impact

This closes a serious real-office privacy gap: a manager should not be able to see or act on employees outside his reporting line. For HR/payroll software, this is not a cosmetic fix — it is a trust requirement.

---

## Stabilization Pass 6 — 2026-05-08

Status: implemented and verified.

### Positive real-office workflow regression

1. Added happy-path workflow regression coverage:
   - Employee submits expense claim.
   - HR/manager approval step advances the expense request.
   - HR/finance final approval completes the expense request.
   - Employee can see the claim as `approved`.
   - Employee applies for half-day leave.
   - HR/manager approval step advances the leave request.
   - HR final approval completes the leave request.
   - Employee can see leave status as `approved`.
   - Leave allocation `usedDays` increments by `0.5`.

2. Fixed default expense workflow completion:
   - Old default: manager → HR → admin.
   - Problem: default org admin accounts are not employee-backed approval actors, so the final step could block real office approval flow.
   - New default: manager → HR/Finance.
   - This keeps the default workflow practical for zero-setup clients while custom approval workflows can still be configured later for stricter companies.

3. Made regression test dates collision-resistant:
   - Future unique dates are used to avoid false failures from prior test-created leave records.

### Verification

- Full E2E regression pack: 28/28 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass confirms two core HR office flows now work end-to-end, not just screen-by-screen:

- Employee reimbursement request can actually reach approved status.
- Employee leave approval can actually update leave balance.

These are release-critical flows for any real HRMS.

---

## Stabilization Pass 7 — 2026-05-08

Status: implemented and verified.

### Payroll and attendance workflow regression

1. Added payroll workflow regression coverage:
   - HR ensures salary structure exists.
   - HR ensures employee salary assignment exists.
   - HR processes payroll for employee.
   - Employee can see the generated payslip through ESS API.
   - Payslip has a non-negative payable net salary.

2. Added attendance workflow regression coverage:
   - Employee check-in is accepted or safely treated as already checked in.
   - Employee can see today's attendance in self-view.
   - Unrelated manager cannot fetch that employee's attendance by employeeId.
   - Unrelated manager team attendance view does not leak that employee's record.

3. Fixed payroll negative net-salary issue:
   - Payroll engine now caps payable `netSalary` at `0` when deductions exceed earnings.
   - This prevents unsafe negative salary slips when attendance data is incomplete or deductions exceed monthly earnings.
   - Detailed deductions remain available for future adjustment/arrears logic.

4. Fixed attendance date filtering:
   - Date-only filters now parse as local office dates, not UTC midnight.
   - This aligns with attendance records stored at local office-day start.
   - Employee/manager views now show today's check-in consistently in Bangladesh/office timezone behavior.

### Verification

- Full E2E regression pack: 30/30 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass covers two office-critical flows:

- Payroll can be processed and an employee can actually see the resulting payslip.
- Attendance check-in is visible to the employee but remains protected from unrelated managers.

The fixes reduce payroll trust risk and attendance timezone confusion — both are high-impact HRMS release concerns.

---

## Stabilization Pass 8 — 2026-05-08

Status: implemented and verified.

### Client onboarding and first-run setup readiness

1. Fixed registration email-verification behavior:
   - New organization owner accounts are now created with `emailVerified: null`.
   - Login remains blocked until the email verification token is consumed.
   - This aligns the product with real SaaS account-ownership expectations.

2. Added practical default organization setup at registration:
   - Default departments: `Administration`, `Operations`.
   - Default designations: `Administrator`, `Manager`, `Employee`.
   - Default branch: `Head Office` in Bangladesh, marked as head office.
   - Existing default leave types, default shift, and standard salary structure remain part of the registration bootstrap.

3. Added onboarding regression coverage:
   - Registers a new tenant organization.
   - Confirms the first admin cannot log in before email verification.
   - Verifies the token through `/api/auth/verify-email`.
   - Confirms the admin can log in after verification.
   - Confirms setup defaults are available through authenticated setup APIs.

### Verification

- New onboarding Playwright spec: 1/1 passed.
- Full E2E regression pack: 31/31 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass improves first-client onboarding quality. A newly registered company is no longer an empty shell; it receives enough safe default setup data for the owner/admin to begin creating employees and configuring the organization without needing technical assistance.

This also closes a real account-security gap: the product now requires email ownership before the first admin can sign in.

---

## Stabilization Pass 9 — 2026-05-08

Status: implemented and verified.

### Employee lifecycle onboarding and first ESS access

1. Closed the admin-created employee access gap:
   - Creating an employee now also creates a linked `User` account with role `employee`.
   - The linked account starts with `password: null` and `emailVerified: null` so the employee cannot sign in until activation.
   - Duplicate employee/user emails are rejected before creation to protect identity integrity.

2. Added practical first-login invitation behavior:
   - Employee creation generates a password-reset invitation token.
   - Invitation email is triggered asynchronously using the existing password reset email path.
   - The API returns only `onboardingInvitationSent`; it does not expose the invitation token.
   - Resetting password through the invitation now also marks the account email as verified, enabling the first ESS login.

3. Improved zero-setup business readiness:
   - New organizations now receive a `starter` trial subscription during registration.
   - This prevents a newly registered client from being blocked by plan enforcement before creating first employees.
   - Employee creation assigns a safe default active branch, preferring head office when available.
   - Salary structure assignment remains part of the employee creation flow.
   - Current-year leave allocations are created immediately from active leave types, respecting gender eligibility, minimum-service rules, and pro-rata leave policy.

4. Added employee lifecycle regression coverage:
   - Admin creates a new employee.
   - Test verifies linked user account, branch assignment, salary assignment, leave allocation setup, hidden invitation token, and blocked login before activation.
   - Test consumes the reset token, sets employee password, confirms ESS login, and verifies `/api/employees/me` returns the employee profile.

### Verification

- Full E2E regression pack: 32/32 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass turns employee creation from an admin-only HR record into a real office onboarding flow. A company admin can create an employee, the system assigns branch/salary/leave readiness, the employee can activate access safely through an invitation/reset flow, and then use ESS from their own account.

This is release-critical because every HR SaaS lives or dies on trust in the employee lifecycle: create employee → assign salary/branch/leave entitlement → activate account → employee self-service works.

---

## Stabilization Pass 10 — 2026-05-08

Status: implemented and verified.

### Employee edit/offboarding lifecycle and HR privacy hardening

1. Hardened manager access to employee detail records:
   - HR/admin roles can view full employee records.
   - Employees can view their own full profile.
   - Managers can view full detail only for direct reportees.
   - Non-reporting managers now receive only public directory-style fields, not salary/NID/bank-sensitive HR data.

2. Synchronized employee updates with linked ESS user accounts:
   - Employee email updates are normalized and checked against both employee records and user accounts.
   - Linked user name/email is kept in sync when HR edits an employee.
   - Setting employment status away from `active` deactivates the linked user account and clears DB-backed sessions.

3. Hardened soft-delete/offboarding:
   - Deleting/offboarding an employee marks them terminated and records `deletedAt`.
   - Active salary assignments are deactivated.
   - Linked ESS login is deactivated.
   - Existing authenticated API access is blocked because `requireAuth()` now rejects inactive users.

4. Added regression coverage:
   - Employee lifecycle test now proves offboarding blocks stale session API access and fresh login.
   - Role workflow security test now proves a non-reporting manager cannot view another employee's full HR profile while admin can.

### Verification

- Full E2E regression pack: 33/33 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass closes a critical real-office lifecycle gap: employees who leave the company should no longer retain ESS/API access, and managers should not see sensitive HR data for employees outside their reporting line.

For a production HR SaaS, this is non-negotiable. Payroll history remains preserved, while identity/access is safely locked when HR offboards someone.

---

## Stabilization Pass 11 — 2026-05-08

Status: implemented and verified.

### Post-offboarding action lockout

1. Hardened employee-authenticated action access:
   - `requireEmployee()` now requires the linked employee profile to be active and not soft-deleted.
   - Inactive/terminated/deleted employee profiles are rejected even if a stale session still exists.

2. Hardened leave and expense creation:
   - Leave application creation now rejects inactive or deleted employee profiles.
   - Expense claim listing/creation now rejects inactive users.
   - Expense claim creation now rejects inactive or deleted employee profiles.

3. Extended lifecycle regression coverage:
   - After HR offboards an employee, the stale employee session is blocked from:
     - `/api/employees/me`
     - attendance check-in
     - expense submission
     - leave application
   - Fresh login also remains blocked after offboarding.

### Verification

- Full E2E regression pack: 33/33 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass closes the practical post-offboarding risk. Once HR terminates/offboards an employee, that person can no longer continue using ESS actions through an old browser session. Historical payroll, leave, and expense records remain preserved, but new employee actions are locked.

---

## Stabilization Pass 12 — 2026-05-08

Status: implemented and verified.

### Safe employee reactivation and credential reset workflow

1. Hardened reactivation after offboarding:
   - Reactivating an employee by setting `employmentStatus: active` now clears `deletedAt`.
   - Linked ESS user is re-enabled, but password and email verification are reset.
   - A fresh password-reset/reactivation invitation token is created and emailed through the existing password reset email template.
   - Old DB-backed sessions are cleared during reactivation.

2. Prevented stale-session resurrection:
   - `requireAuth()` now rejects unverified users as well as inactive users.
   - This prevents an old browser session from becoming valid again immediately after HR reactivates a user.
   - The employee must complete the new reset/verification flow before ESS access resumes.

3. Fixed salary readiness after reactivation:
   - If an employee was offboarded and salary assignment deactivated, reactivation/editing now restores an active salary assignment when salary data is supplied.
   - Regression caught this edge case before documentation; fix was applied before the full gate.

4. Extended lifecycle regression coverage:
   - Create employee and activate first login.
   - Offboard employee and verify old session/actions/fresh login are blocked.
   - Reactivate employee and verify stale session is still blocked.
   - Verify old password login remains blocked until the reactivation reset token is used.
   - Reset password again and confirm ESS login/API access works after reactivation.

### Verification

- Full E2E regression pack: 33/33 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass makes employee reactivation safe enough for real offices. HR can recover from accidental offboarding or rehire a returning employee without silently restoring old sessions or stale passwords. Access returns only through a fresh reset/verification flow, while salary readiness is restored for normal HR operations.

---

## Stabilization Pass 13 — 2026-05-08

Status: implemented and verified.

### HR/Admin employee lifecycle UI hardening

1. Clarified list-page offboarding UX:
   - Employee removal action now uses offboarding language instead of destructive delete language.
   - Confirmation explains that ESS login is locked, active sessions are cleared, and payroll/history records are preserved.
   - Success message confirms the employee was offboarded and ESS access was locked.

2. Hardened employee edit lifecycle warnings:
   - Editing an inactive employee now shows reactivation guidance before the form.
   - Changing an active employee to a non-active status shows an offboarding warning and submit confirmation.
   - Changing an inactive employee back to active shows a reactivation warning and submit confirmation.
   - Reactivation success message tells HR that a fresh reset invitation is required before ESS access resumes.

3. Preserved backend-safe behavior in UI flow:
   - Update success now redirects to the saved employee detail page instead of the generic employee list when possible.
   - UI wording now matches the hardened backend lifecycle model: offboarding preserves records, reactivation never silently restores old password/session access.

4. Regression coverage:
   - Extended employee lifecycle Playwright regression to visit the inactive employee edit page and verify fresh-reset reactivation guidance is visible.

### Verification

- Full E2E regression pack: 33/33 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass makes the HR/Admin employee lifecycle UI safer for real office operators. HR users now see the consequence of offboarding/reactivation before they act, with wording aligned to the secure backend behavior. This reduces accidental access restoration, accidental destructive assumptions, and confusion during employee termination or rehire workflows.

---

## Stabilization Pass 14 — 2026-05-08

Status: implemented and verified.

### Payroll final-settlement readiness after offboarding

1. Closed final payroll gap for terminated/offboarded employees:
   - Bulk payroll still processes only active, non-deleted employees.
   - Explicit HR-selected payroll can now include an offboarded/terminated employee for final settlement.
   - This enables HR to process an unpaid month after offboarding without reactivating the employee or restoring ESS access.

2. Hardened salary assignment lookup:
   - Normal salary calculation still requires an active salary assignment.
   - Explicit final-settlement calculation can use the latest salary assignment effective for the payroll period, even if it was deactivated during offboarding.
   - Assignment lookup is ordered by latest effective date, avoiding ambiguous historical assignment selection.

3. Regression coverage:
   - Employee lifecycle regression now verifies that after final offboarding:
     - HR can explicitly process payroll for the terminated employee.
     - The employee remains terminated.
     - The linked ESS user remains inactive.
     - No active salary assignment is silently restored.

### Verification

- Full E2E regression pack: 33/33 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 265/265 passed.
- `npm run build` — passed with existing Turbopack NFT warning.
- `git diff --check` — passed.

### Business impact

This pass makes offboarding financially safer for real offices. HR can terminate access immediately, preserve records, and still complete a final payroll/settlement later. This avoids the dangerous workaround of reactivating an employee merely to pay their pending salary.

---

## Stabilization Pass 15 — 2026-05-08

Status: implemented and verified.

### Payroll + attendance + leave business accuracy hardening

1. Fixed late-attendance double-penalty risk:
   - Payroll now treats `late` attendance as a payable present day.
   - Late employees receive late deduction only through the late-deduction engine, not both late deduction and absent deduction.

2. Fixed cross-month leave over-counting:
   - Payroll no longer uses the full leave application `totalDays` blindly when a leave overlaps the payroll month.
   - It now counts only the leave days inside the payroll period.
   - Example: March 30–April 2 leave contributes only April 1–2 to April payroll.

3. Fixed half-day payroll representation:
   - Half-day attendance/leave is now calculated as `0.5` day where appropriate.
   - Salary slip day-count fields were changed from integer to float via migration so payroll can accurately store fractional day counts.

4. Added regression coverage:
   - Payroll integration tests now cover cross-month leave, late attendance as present, and half-day leave/attendance fractional calculation.
   - Unit regression count increased from 265 to 268 tests.

### Verification

- Full E2E regression pack: 33/33 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 268/268 passed.
- `npm run build` — passed with existing Turbopack NFT warnings.
- `git diff --check` — passed.

### Business impact

This pass prevents payroll mistakes that real offices would notice immediately: late staff should not be punished twice, cross-month leave should not deduct the wrong month, and half-day leave must be represented as half a day. Payroll accuracy is now materially stronger for attendance/leave-driven salary processing.

---

## Stabilization Pass 16 — 2026-05-08

Status: implemented and verified.

### Tenant isolation + manager privacy hardening

1. Added cross-tenant security regression coverage:
   - A second registered/verified tenant admin cannot fetch another organization’s employee detail.
   - A second tenant cannot discover another organization’s employee through employee search.
   - A second tenant cannot list another organization’s payroll slips using another tenant’s employee id.
   - A second tenant cannot download another organization’s salary slip PDF.
   - A second tenant cannot explicitly process payroll for another organization’s employee id.

2. Hardened manager expense list scoping:
   - Manager expense list filtering by `employeeId` is now scoped to the manager’s own employee profile or direct reportees only.
   - Previously, a same-organization manager who guessed another employee id could potentially list non-reportee claims via the list endpoint, even though single-claim access/approval was already protected.

3. Expanded security regression pack:
   - `workflow-security.spec.ts` now covers 5 security scenarios, including cross-tenant isolation and manager list privacy.
   - Full E2E regression count increased from 33 to 35 tests.

### Verification

- Prisma client regenerated successfully.
- Full E2E regression pack: 35/35 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 268/268 passed.
- `npm run build` — passed with existing Turbopack NFT warnings.
- `git diff --check` — passed.

### Business impact

This pass strengthens PeopleFlow’s SaaS security posture. Cross-company HR/payroll data remains isolated in critical employee and payroll flows, and manager-level expense visibility is now tighter. This is a required foundation before any production use with multiple real client organizations.

---

## Stabilization Pass 17 — 2026-05-08

Status: implemented and verified.

### API-wide tenant/role isolation audit — loans and sensitive API expansion

1. Audited sensitive id-based API routes:
   - Employee detail/profile data
   - Payroll processing/listing/slip download
   - Expense claims list/detail/actions
   - Leave applications detail/actions
   - Loans list/create/update/delete
   - Organization setup resources such as branches/departments/designations/shifts/leave types
   - Platform-scoped endpoints separated from tenant auth

2. Fixed loan authorization gaps:
   - Regular employees can now create loan requests only for their own linked employee profile.
   - Managers can list loans only for themselves and direct reportees.
   - Managers can update/approve only direct reportee loans, not arbitrary organization loans.
   - HR/admin roles retain organization-wide loan administration.

3. Expanded security regression coverage:
   - Added loan API security test proving:
     - Employee cannot create a loan for another employee.
     - Non-reporting manager cannot see that employee’s loan in `/api/loans`.
     - Non-reporting manager cannot approve/update that employee’s loan.
   - Full E2E regression count increased from 35 to 36 tests.

### Verification

- Prisma client regenerated successfully.
- Full E2E regression pack: 36/36 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 268/268 passed.
- `npm run build` — passed with existing Turbopack NFT warnings.
- `git diff --check` — passed.

### Business impact

This pass closes another real SaaS authorization class: financial/loan data access and mutation must follow employee self-scope, manager direct-report scope, and HR/admin organization scope. PeopleFlow is now safer against guessed-id access across loans, expenses, payroll, leaves, and employee records covered by regression.


## Stabilization Pass 18 — 2026-05-08

Status: implemented and verified.

### Upload/Documents/File Access Security

1. Audited upload and file serving paths:
   - `src/app/api/upload/route.ts`
   - `src/app/api/uploads/[...path]/route.ts`
   - `src/lib/storage.ts`
   - Expense receipt upload consumer and employee/profile document usage.

2. Hardened upload permissions by folder sensitivity:
   - Regular employees can upload expense receipts and avatars only.
   - HR/admin-level roles can upload sensitive employee/document/resume folders.
   - This prevents an ESS user from placing arbitrary sensitive HR documents into tenant storage.

3. Hardened file download permissions beyond tenant-prefix checking:
   - Profile images/avatars remain visible to authenticated users inside the same organization.
   - Expense receipts are limited to HR/admin, the owning employee, or an authorized direct manager when tied to an expense claim.
   - Sensitive documents/resumes are HR-only until explicit per-file ownership metadata is introduced.
   - Existing path traversal and tenant-prefix checks remain in place.

4. Added a minimal ownership signal for new receipt uploads:
   - Receipt filenames now include the authenticated employee id prefix server-side.
   - The prefix is not trusted from the client; it is derived from auth context.
   - This allows the uploader to access a newly uploaded receipt before the expense claim record is created, without opening same-tenant guessing access.

5. Expanded regression coverage:
   - Employee document upload to `documents` is rejected.
   - Employee can upload and retrieve own receipt.
   - Unrelated/non-reporting manager cannot retrieve another employee’s receipt by guessed URL.
   - HR/admin can retrieve organization receipt.
   - Full E2E regression count increased from 36 to 37 tests.

### Verification

- Prisma client regenerated successfully.
- Full E2E regression pack: 37/37 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 268/268 passed.
- `npm run build` — passed with existing Turbopack NFT warnings.
- `git diff --check` — passed.

### Business impact

This pass closes a high-risk SaaS data exposure class: authenticated users inside the same company should not automatically be able to open sensitive HR documents or colleagues’ receipts by guessing/upload URL discovery. PeopleFlow now has safer file access defaults for real office use while preserving normal avatar and expense workflows.

### Backlog / future upgrade

- Add first-class `FileAsset`/`Document` metadata table with owner, category, sensitivity, linked entity, retention policy, virus-scan status, and audit trail.
- Add signed short-lived URLs for downloads instead of direct static-like upload URLs.
- Add storage quota accounting per tenant and document lifecycle/retention controls.

---


## Stabilization Pass 19 — 2026-05-08

Status: implemented and verified.

### Account Security / 2FA / Session Invalidation

1. Audited authentication and account-security paths:
   - `src/lib/auth.ts`
   - `src/lib/auth.config.ts`
   - `src/lib/api-auth.ts`
   - `src/app/api/auth/change-password/route.ts`
   - `src/app/api/auth/reset-password/route.ts`
   - `src/app/api/auth/2fa/setup/route.ts`
   - `src/app/api/auth/2fa/verify/route.ts`
   - Login UI and auth regressions.

2. Enforced authenticator-based 2FA at login:
   - Login credentials now accept an optional authenticator code.
   - Accounts with `twoFactorEnabled` must provide a valid TOTP code.
   - Accounts with broken 2FA configuration are blocked with a clear security error.
   - Login page now exposes an authenticator-code field for 2FA-enabled users.

3. Added per-user JWT/session invalidation:
   - Added `User.sessionVersion` with migration `20260508203000_user_session_version`.
   - JWT sessions store the login-time session version.
   - `requireAuth()` rejects stale sessions when the database version changes.

4. Hardened password changes/resets:
   - Password change now uses the central strong-password validator.
   - Password change rejects same-password reuse and last-5 password reuse using `PasswordHistory`.
   - Password change increments `sessionVersion` and deletes database sessions.
   - Password reset increments `sessionVersion` and deletes database sessions.
   - Result: old authenticated sessions cannot keep using sensitive APIs after credential rotation.

5. Expanded regression coverage:
   - Login requires valid authenticator code when 2FA is enabled.
   - Password change invalidates the existing authenticated API session.
   - Full E2E regression count increased from 37 to 39 tests.

### Verification

- Prisma client regenerated successfully.
- Disposable E2E database schema updated with the new session version field.
- Targeted auth/security regression: 14/14 passed.
- Full E2E regression pack: 39/39 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 268/268 passed.
- `npm run build` — passed with existing Turbopack NFT warnings.
- `git diff --check` — passed.

### Business impact

This pass closes two serious account-takeover risks for a real HR/payroll SaaS: enabled 2FA is now actually enforced at login, and old sessions are invalidated after password change/reset. This protects payroll, employee PII, HR documents, and admin controls if credentials are rotated after compromise or staff turnover.

### Backlog / future upgrade

- Add admin-managed 2FA reset/recovery workflow with audit logging.
- Add backup recovery codes for 2FA.
- Add security event notifications for password changes, 2FA changes, and suspicious logins.
- Add optional force-logout-all-devices button in user security settings.

---


## Stabilization Pass 20 — 2026-05-08

Status: implemented and verified.

### Billing / Trial / Storage Plan Enforcement

1. Audited SaaS plan and billing enforcement paths:
   - `src/lib/plan-enforcement.ts`
   - `src/lib/redis.ts`
   - `src/app/api/billing/status/route.ts`
   - `src/app/api/billing/checkout/route.ts`
   - `src/app/api/webhooks/stripe/route.ts`
   - `src/app/api/upload/route.ts`
   - Plan-gated API/resource creation flows.

2. Fixed expired trial/period enforcement:
   - `getOrgSubscription()` now normalizes `trialing` subscriptions to `expired` after `trialEnd`.
   - `active` subscriptions with an expired `currentPeriodEnd` are normalized to `expired`.
   - Cached subscription records now carry `trialEnd` and `currentPeriodEnd`, so cached checks also respect expiry.
   - Result: tenants cannot silently continue paid-plan actions forever if Stripe/webhook/status update is delayed or missing.

3. Fixed storage-limit enforcement:
   - Storage resource count now calculates live tenant upload usage from `uploads/<organizationId>`.
   - The latest live value is recorded to `UsageRecord` for reporting/history.
   - Upload plan enforcement now blocks new uploads when storage limit is reached.

4. Expanded regression coverage:
   - Expired trial tenant is blocked from new upload/resource usage with HTTP 402.
   - Tenant with zero storage override is blocked from new uploads using live storage usage.
   - Full E2E regression count increased from 39 to 41 tests.

### Verification

- Prisma client regenerated successfully.
- Targeted billing/security regression: 10/10 passed.
- Full E2E regression pack: 41/41 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with existing warnings only.
- `npm test` — 268/268 passed.
- `npm run build` — passed with existing Turbopack NFT warnings.
- `git diff --check` — passed.

### Business impact

This pass closes a real SaaS revenue and risk-control gap: expired trials or expired periods no longer keep receiving paid storage/resource capability just because status cleanup/webhook timing lags. Storage quotas also now reflect actual uploaded files instead of a placeholder zero value.

### Backlog / future upgrade

- Add scheduled billing reconciler to mark expired trials/periods and notify tenants before lockout.
- Add tenant billing banner/grace-period UX instead of only API-level blocking.
- Add object-storage-native usage accounting for S3/R2 when production storage moves beyond local disk.
- Add per-file retention policies and storage cleanup tooling.

---

---

## Stabilization Pass 21 — 2026-05-08

### Release-grade gate and visual UAT

- Ran lint/typecheck/build gates after the 45-test E2E baseline:
  - `npm run lint` → passed with warnings only.
  - `npx tsc --noEmit` → passed.
  - `npm run build` → passed.
- Ran production-mode role visual UAT across 22 pages:
  - Admin: dashboard, employees, attendance, payroll, expenses, reports.
  - HR: dashboard, employees, leave requests, expenses, payroll.
  - Manager: dashboard, team, approvals, attendance, leaves.
  - Employee mobile: dashboard, attendance, leaves, expenses, payslips, profile.
- Fixed Employee mobile `/ess/profile` horizontal overflow by making profile tabs responsive on small screens.

### Verification

- Visual UAT script result: **22 checked, 0 failures**.
- Employee mobile `/ess/profile` overflow: **fixed**.
- Production Redis prerequisite confirmed: production login rate limiting is fail-closed when Redis is unavailable; deployment must keep Redis healthy.

### Remaining after Pass 21

- Non-blocking cleanup: legacy lint warnings.
- Non-blocking build hardening: Turbopack NFT trace warning involving Prisma/`next.config.ts` import trace.
- Next recommended step: cleanup temporary QA files, then prepare an organized checkpoint commit/review package.

### Follow-up: QA-safe auth rate limit configuration

The production-mode full E2E rerun hit the strict Redis-backed auth limit (`10` login attempts / `15min`) from localhost. This caused cascading login failures while the app itself was healthy.

Fix applied:

- Added `RATE_LIMIT_AUTH_MAX` and `RATE_LIMIT_AUTH_WINDOW_MS` env overrides for controlled QA/E2E environments.
- Production defaults remain unchanged and strict.
- Full E2E rerun with `RATE_LIMIT_AUTH_MAX=1000`: **45/45 passed**.
