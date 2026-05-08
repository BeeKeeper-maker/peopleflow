# PeopleFlow HR Project — Senior Audit Notes

Date: 2026-05-08
Branch: beta-launch-hardening

## Verification Gates

- `npm run lint`: previously passed with warnings only
- `npx tsc --noEmit`: previously passed
- `npx prisma validate`: previously passed
- `npm test`: previously passed, 265 tests
- `npm run build`: previously passed
- `npm audit --audit-level=moderate`: previously passed, 0 vulnerabilities
- `npm run test:e2e`: initially failed because port 3000 was serving a different site, not this app. Re-tested HR app on port 3100 with a no-webServer Playwright config: 21/21 passed.

## Current Assessment

The application is a substantial and credible HR/SaaS codebase, not a toy prototype. It has a wide feature surface, schema depth, tests, and beta-hardening work. However, it is not yet approved for general production launch. It needs targeted security, tenancy, and feature-completeness fixes before real client data.

## High-Priority Findings

### 1. Email verification bypass — fixed in Stabilization Pass 8

Evidence: `src/app/api/auth/register/route.ts`, `tests/e2e/onboarding-registration.spec.ts`

Original issue: registration set `emailVerified: new Date()` while still sending a verification email and returning `requiresVerification: true`, which meant the verification gate was effectively bypassed.

Current status: fixed. New registered users are created with `emailVerified: null`; login remains blocked until the verify-email endpoint consumes a valid token. A Playwright regression now verifies the blocked-login and post-verification-login behavior.

Residual note: real SMTP/DNS delivery still needs staging verification once Brevo/domain setup is available.

### 2. 2FA exists as backend endpoints but is not enforced during login

Evidence:
- `src/app/api/auth/2fa/setup/route.ts`
- `src/app/api/auth/2fa/verify/route.ts`
- `src/lib/auth.ts`
- `src/app/login/page.tsx`
- Profile/settings UI mark 2FA as coming soon.

Impact: Users can enable a secret in DB, but login does not require TOTP verification. So 2FA is not a real protection yet.

Fix: Add a 2-step credential flow or NextAuth callback flow that requires TOTP when `twoFactorEnabled` is true. Add rate limiting and recovery codes.

### 3. Password change flow is basic and does not invalidate existing sessions

Evidence: `src/app/api/auth/change-password/route.ts`

The endpoint verifies current password and hashes the new one, but it only checks length >= 8, does not use the stronger shared password validator, does not update PasswordHistory, and does not invalidate active sessions/JWTs.

Impact: If an account is compromised, changing password may not kick out existing sessions.

Fix: Add password policy reuse checks, password history writes, and a `sessionVersion` or `passwordChangedAt` claim check in JWT/session callbacks.

### 4. RLS exists but many routes still use direct `prisma`

Evidence:
- `src/lib/prisma.ts` documents direct `prisma` as no-RLS/backward-compatible
- Many API routes manually filter `organizationId`

Impact: Most routes appear manually scoped, but security depends on every developer remembering to add `organizationId`. This is fragile for a multi-tenant SaaS.

Fix: Gradually move tenant routes to `auth.withDB(...)` / `withTenant(...)`; add route tests that attempt cross-tenant access.

### 5. Sync-agent download can embed API keys in a public GET URL

Evidence: `src/app/api/sync-agent/download/route.ts`

The endpoint accepts `?key=...` and injects the key into a downloadable JS file. The endpoint itself has no auth check.

Impact: API keys can leak via browser history, proxy logs, screenshots, referrers, shared links, etc.

Fix: Require HR auth, generate the agent server-side only for the key owner, avoid putting raw key in query params, prefer one-time token or post-download copy flow.

### 6. Billing storage usage is placeholder

Evidence: `src/app/api/billing/status/route.ts` returns storage current as `0` with TODO.

Impact: Plan enforcement/reporting may mislead tenants/admins.

Fix: Track upload sizes per org or calculate from file metadata.

## Positive Findings

- Strong feature breadth: employees, attendance, leave, payroll, expenses, approvals, reports, ESS, manager portal, platform admin, billing, sync agent.
- Prisma schema is mature: 61 models.
- E2E tests pass when pointed at the correct app server.
- Stripe webhook verifies signatures and uses Redis-backed idempotency.
- Upload serving is tenant-scoped and blocks path traversal.
- Employee creation includes org-scoped FK validation, plan enforcement, linked ESS user creation, salary assignment, branch assignment, leave allocation setup, and invitation-based first login.
- Cron routes use cron secret auth.
- External API v1 uses hashed API keys and permission checks.

## Recommended Next Fix Order

1. Either remove/label 2FA as unavailable or complete login enforcement.
2. Harden password change/reset session invalidation.
3. Lock sync-agent download behind authenticated HR route and remove key-in-query pattern.
4. Add cross-tenant route tests for critical APIs.
5. Convert high-risk tenant routes to `withTenant`/RLS runtime.
6. Add real billing storage usage.
7. Verify real SMTP/DNS email delivery on staging.
8. Run end-to-end employee invitation email UAT with real SMTP, not DB-token shortcut.
9. Run role-based UAT on staging with admin, HR, manager, employee, platform admin.

## Verdict

Beta/staging: acceptable for controlled testing.
Production with real client HR data: not yet.

The app is promising and significantly beyond a simple AI-generated prototype, but it needs targeted hardening before it should hold real payroll, employee, and identity data.


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
