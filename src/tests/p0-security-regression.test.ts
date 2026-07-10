/**
 * ═══════════════════════════════════════════════════════════════════
 * P0 SECURITY REGRESSION TESTS
 * ═══════════════════════════════════════════════════════════════════
 *
 * Regression coverage for the P0 security fixes shipped in commit
 * 5302ef5 ("P0-SECURITY: Fix 2FA bypass, impersonation replay,
 * sessionVersion stale, partial-auth routes, bKash multi-tenant leak").
 *
 * Scope:
 *   a) 2FA disable requires re-auth (currentPassword + TOTP/recovery)
 *      — DELETE /api/auth/2fa/setup
 *   b) Impersonation token single-use (consumed on first validation)
 *      — validateImpersonationToken()
 *   c) bKash multi-tenant cache isolation (keyed by organizationId)
 *      — disbursement-engine bkashTokenCache
 *   d) sessionVersion increment on role change / deactivation
 *      — PATCH /api/access/users
 *
 * Determinism: every DB call is intercepted via the global prisma mock
 * (src/tests/setup.ts); no real DB or Redis is touched. `fetch` is
 * stubbed with vi.spyOn for the bKash token-grant + b2c endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mocks (hoisted by vitest) ────────────────────────────────
// The 2FA route dynamically imports bcryptjs, otplib, @/lib/recovery-codes;
// the access/users route uses @/lib/api-auth; the impersonation lib uses
// @/lib/platform-auth; the disbursement engine uses @/lib/audit-log,
// @/lib/pii, @/lib/crypto. Mock them all up-front so the modules under
// test resolve cleanly.

vi.mock("@/lib/platform-auth", () => ({
    // impersonation.ts only uses logPlatformAction; other exports stubbed
    // so the rest of the module surface doesn't pull in next-auth.
    logPlatformAction: vi.fn().mockResolvedValue(undefined),
    verifyPlatformToken: vi.fn(),
    createPlatformToken: vi.fn(),
    requirePlatformAdmin: vi.fn(),
    platformAuth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    getApiUser: vi.fn(),
    auth: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
    requireAuth: vi.fn(),
    requireAdminOrHR: vi.fn(),
    requireRole: vi.fn(),
    requireEmployee: vi.fn(),
    requireManagerOrAbove: vi.fn(),
    // isAuthenticated narrows AuthContext | NextResponse → AuthContext.
    // A NextResponse has `.status` (number); AuthContext does not.
    isAuthenticated: vi.fn(
        (result: unknown): boolean =>
            !(result !== null && typeof result === "object" && "status" in (result as object)),
    ),
    AuthErrors: {
        UNAUTHORIZED: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
        FORBIDDEN: () => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
        NO_ORGANIZATION: () => new Response(JSON.stringify({ error: "No org" }), { status: 400 }),
        NO_EMPLOYEE: () => new Response(JSON.stringify({ error: "No employee" }), { status: 400 }),
        ORG_INACTIVE: () => new Response(JSON.stringify({ error: "Org inactive" }), { status: 403 }),
    },
}));

vi.mock("@/lib/audit-log", () => ({
    createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/pii", () => ({
    decryptPii: vi.fn((v: string | null | undefined) => v ?? null),
    encryptPii: vi.fn((v: string | null | undefined) => v ?? null),
    decryptPII: vi.fn((v: string | null | undefined) => v ?? null),
    encryptPII: vi.fn((v: string | null | undefined) => v ?? null),
}));

vi.mock("@/lib/crypto", () => ({
    decrypt: vi.fn((v: string) => v),
    encrypt: vi.fn((v: string) => v),
    isEncrypted: vi.fn(() => false),
}));

vi.mock("@/lib/event-bus", () => ({
    emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    RATE_LIMIT_CONFIGS: { read: {}, heavy: {}, write: {} },
}));

// 2FA route does `await import("bcryptjs")` and uses `bcrypt.compare` —
// which accesses the NAMED export. Mock both default + named, sharing the
// same vi.fn instance so test setup via either import style mutates the
// function actually called by the route.
vi.mock("bcryptjs", () => {
    const compare = vi.fn();
    const hash = vi.fn();
    return {
        default: { compare, hash },
        compare,
        hash,
    };
});

// 2FA route does `await import("otplib")` and destructures `verify` —
// the named export. Same shared-function pattern as bcrypt.
vi.mock("otplib", () => {
    const verify = vi.fn(() => true);
    const generateSecret = vi.fn(() => "MOCK_SECRET_123");
    const generateURI = vi.fn(() => "otpauth://totp/test");
    return {
        default: { verify, generateSecret, generateURI },
        verify,
        generateSecret,
        generateURI,
        authenticator: { verify, generateSecret, generateURI },
    };
});

// 2FA setup POST uses QRCode.toDataURL — only matters for the POST route,
// but we mock it so the module loads cleanly.
vi.mock("qrcode", () => ({
    default: {
        toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,MOCK"),
    },
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,MOCK"),
}));

// recovery-codes module is dynamically imported by the 2FA route when
// a recovery code is supplied. Mock it so the import resolves.
vi.mock("@/lib/recovery-codes", () => ({
    verifyRecoveryCode: vi.fn().mockResolvedValue(null),
    generateRecoveryCodes: vi.fn().mockResolvedValue({ plaintext: [], hashes: [] }),
    getRemainingCodeCount: vi.fn(() => 0),
    shouldWarnLowCodes: vi.fn(() => false),
}));

// ── Imports under test ─────────────────────────────────────────────
import { DELETE } from "@/app/api/auth/2fa/setup/route";
import { validateImpersonationToken } from "@/lib/impersonation";
import { disburseSalary } from "@/lib/disbursement-engine";
import { PATCH as patchUserAccess } from "@/app/api/access/users/route";
import prisma from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import bcrypt from "bcryptjs";
import * as otplib from "otplib";

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function makeDeleteRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/auth/2fa/setup", {
        method: "DELETE",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

function makePatchRequest(body: unknown): Request {
    return new Request("http://localhost/api/access/users", {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

/** Build a successful bKash fetch mock: token grant + b2c both succeed. */
function mockBkashFetchSuccess() {
    return vi.fn(async (url: URL | string) => {
        const u = url.toString();
        if (u.includes("/token/grant")) {
            return {
                ok: true,
                json: async () => ({
                    statusCode: "0000",
                    idToken: "TOKEN-" + Math.random().toString(36).slice(2, 8),
                    statusMessage: "Successful",
                }),
            } as Response;
        }
        // b2c
        return {
            ok: true,
            json: async () => ({
                statusCode: "0000",
                transactionStatus: "Completed",
                trnxID: "bkash-txn-" + Math.random().toString(36).slice(2, 8),
            }),
        } as Response;
    });
}

/** Wire up every prisma method that disburseSalary touches for a happy path. */
function setupDisbursementPrismaStubs(orgId: string, slipId: string) {
    // slip.netSalary is a Prisma.Decimal in prod but `toNumber()` (from
    // payroll-engine) accepts plain numbers — pass 5000 directly so the
    // disbursement record and b2c call receive a real numeric amount.
    vi.mocked(prisma.salarySlip.findFirst).mockResolvedValue({
        id: slipId,
        status: "approved",
        isLocked: false,
        netSalary: 5000,
        employee: { id: "emp-001", firstName: "Test", lastName: "User", email: "test@example.com" },
    } as never);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: orgId,
        settings: {
            bkashConfig: {
                baseUrl: "https://tokenized.pay.bka.sh/v1.2.0-beta",
                username: "user-" + orgId,
                password: "pass-" + orgId,
                appKey: "appKey-" + orgId,
                appSecret: "appSecret-" + orgId,
            },
        },
    } as never);
    vi.mocked(prisma.salaryDisbursement.create).mockResolvedValue({
        id: "disb-" + slipId,
    } as never);
    vi.mocked(prisma.salaryDisbursement.update).mockResolvedValue({} as never);
    vi.mocked(prisma.salarySlip.update).mockResolvedValue({} as never);
    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
        id: "emp-001",
        phone: "01711111111",
        customFields: {},
        bkashNumber: null,
    } as never);
}

// ═══════════════════════════════════════════════════════════════════
// a) 2FA Disable Requires Re-Authentication
// ═══════════════════════════════════════════════════════════════════

describe("[P0-SECURITY] 2FA disable requires re-authentication", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: caller is authenticated
        vi.mocked(getApiUser).mockResolvedValue({
            user: {
                id: "user-001",
                email: "test@example.com",
                twoFactorEnabled: true,
            },
            organizationId: "org-001",
            role: "admin",
        } as never);
    });

    it("returns 400 when currentPassword is missing from body", async () => {
        const res = await DELETE(makeDeleteRequest({ totpCode: "123456" }));

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/password/i);
        // Should never have touched prisma.user.* for the disable flow
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("returns 403 when currentPassword is incorrect", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user-001",
            password: "$2a$12$hashed",
            twoFactorSecret: "secret",
            twoFactorEnabled: true,
            twoFactorRecoveryCodes: [],
        } as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        const res = await DELETE(
            makeDeleteRequest({ currentPassword: "wrong-password", totpCode: "123456" }),
        );

        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error).toMatch(/incorrect/i);
        expect(prisma.user.update).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ twoFactorEnabled: false }),
            }),
        );
    });

    it("returns 400 when 2FA is enabled but no TOTP/recovery code supplied", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user-001",
            password: "$2a$12$hashed",
            twoFactorSecret: "secret",
            twoFactorEnabled: true,
            twoFactorRecoveryCodes: [],
        } as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

        const res = await DELETE(
            makeDeleteRequest({ currentPassword: "correct-password" }),
        );

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/TOTP|recovery/i);
        expect(prisma.user.update).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ twoFactorEnabled: false }),
            }),
        );
    });

    it("succeeds (200) when correct password + valid TOTP are supplied", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user-001",
            password: "$2a$12$hashed",
            twoFactorSecret: "secret",
            twoFactorEnabled: true,
            twoFactorRecoveryCodes: [],
        } as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        // otplib v13's `verify` returns Promise<VerifyResult> — use
        // mockResolvedValue so the mock matches the real signature.
        // (The route does not actually `await` the result, so any value
        // works; we just need the call to not throw.)
        vi.mocked(otplib.verify).mockResolvedValue({ valid: true, delta: 0, epoch: 0, timeStep: 0 } as never);
        vi.mocked(prisma.user.update).mockResolvedValue({ id: "user-001" } as never);

        const res = await DELETE(
            makeDeleteRequest({ currentPassword: "correct-password", totpCode: "123456" }),
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);

        // 2FA was actually disabled in the DB
        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "user-001" },
                data: expect.objectContaining({
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                }),
            }),
        );
    });

    it("rejects invalid TOTP code when 2FA is enabled (locks down P10 await fix)", async () => {
        // P10-FIXES added `await` to the verifyTOTP call. otplib v13's verify
        // is async — without `await` the Promise object is always truthy and
        // `result?.valid` becomes undefined (falsy) → would always reject,
        // masking the bug. This test confirms the negative path: when the
        // awaited result returns { valid: false }, the route rejects with 403.
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user-001",
            password: "$2a$12$hashed",
            twoFactorSecret: "test-secret",
            twoFactorEnabled: true,
            twoFactorRecoveryCodes: [],
        } as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        // Mock verifyTOTP to resolve with valid:false — an invalid 6-digit code.
        vi.mocked(otplib.verify).mockResolvedValue({
            valid: false,
            delta: undefined,
            epoch: 0,
            timeStep: 0,
        } as never);

        const res = await DELETE(
            makeDeleteRequest({
                currentPassword: "correct-password",
                totpCode: "000000", // invalid code
            }),
        );

        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error).toContain("Invalid");

        // 2FA MUST NOT be disabled when the TOTP code is wrong.
        expect(prisma.user.update).not.toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ twoFactorEnabled: false }),
            }),
        );
    });

    it("returns 401 when the caller is not authenticated (no session)", async () => {
        vi.mocked(getApiUser).mockResolvedValue(null);

        const res = await DELETE(
            makeDeleteRequest({ currentPassword: "anything", totpCode: "123456" }),
        );

        expect(res.status).toBe(401);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// b) Impersonation Token Single-Use
// ═══════════════════════════════════════════════════════════════════

describe("[P0-SECURITY] impersonation token is single-use", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns valid user info on first use of an active token AND marks it consumed", async () => {
        const future = new Date(Date.now() + 60 * 60 * 1000);
        vi.mocked(prisma.impersonationSession.findFirst).mockResolvedValue({
            id: "sess-001",
            token: "token-abc",
            targetUserId: "user-target",
            targetOrganizationId: "org-001",
            platformAdminId: "admin-001",
            status: "active",
            expiresAt: future,
        } as never);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user-target",
            email: "target@example.com",
            name: "Target User",
            role: "admin",
            organizationId: "org-001",
        } as never);
        vi.mocked(prisma.impersonationSession.update).mockResolvedValue({} as never);

        const result = await validateImpersonationToken("token-abc");

        expect(result.valid).toBe(true);
        expect(result.user?.id).toBe("user-target");
        expect(result.user?.email).toBe("target@example.com");
        expect(result.sessionId).toBe("sess-001");

        // CRITICAL: the token MUST be marked consumed before returning
        expect(prisma.impersonationSession.update).toHaveBeenCalledWith({
            where: { id: "sess-001" },
            data: { status: "consumed" },
        });
    });

    it("returns invalid on a second presentation of an already-consumed token (replay attack)", async () => {
        // Simulate the state AFTER the first call has consumed the token:
        // the same row is still in DB but its status is now "consumed".
        vi.mocked(prisma.impersonationSession.findFirst).mockResolvedValue({
            id: "sess-001",
            token: "token-abc",
            targetUserId: "user-target",
            targetOrganizationId: "org-001",
            platformAdminId: "admin-001",
            status: "consumed",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        } as never);

        const result = await validateImpersonationToken("token-abc");

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/already been used/i);
        // Should NOT attempt to consume again
        expect(prisma.impersonationSession.update).not.toHaveBeenCalled();
        // Should NOT leak user data
        expect(result.user).toBeUndefined();
    });

    it("returns invalid when the token does not exist (never issued or pruned)", async () => {
        vi.mocked(prisma.impersonationSession.findFirst).mockResolvedValue(null);

        const result = await validateImpersonationToken("never-issued");

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/invalid|expired/i);
        expect(prisma.impersonationSession.update).not.toHaveBeenCalled();
    });

    it("returns invalid when the session has expired (even though status=active)", async () => {
        const past = new Date(Date.now() - 60 * 60 * 1000);
        vi.mocked(prisma.impersonationSession.findFirst).mockResolvedValue({
            id: "sess-002",
            token: "token-expired",
            targetUserId: "user-target",
            targetOrganizationId: "org-001",
            platformAdminId: "admin-001",
            status: "active",
            expiresAt: past,
        } as never);

        const result = await validateImpersonationToken("token-expired");

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/invalid|expired/i);
        // Should NOT mark as consumed (it's already expired)
        expect(prisma.impersonationSession.update).not.toHaveBeenCalled();
    });

    it("returns invalid when the target user no longer exists", async () => {
        const future = new Date(Date.now() + 60 * 60 * 1000);
        vi.mocked(prisma.impersonationSession.findFirst).mockResolvedValue({
            id: "sess-003",
            token: "token-orphan",
            targetUserId: "user-gone",
            targetOrganizationId: "org-001",
            platformAdminId: "admin-001",
            status: "active",
            expiresAt: future,
        } as never);
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

        const result = await validateImpersonationToken("token-orphan");

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/no longer exists/i);
        // Should NOT mark as consumed (failed validation)
        expect(prisma.impersonationSession.update).not.toHaveBeenCalled();
    });

    it("returns invalid when the target user has no organization (orphaned)", async () => {
        const future = new Date(Date.now() + 60 * 60 * 1000);
        vi.mocked(prisma.impersonationSession.findFirst).mockResolvedValue({
            id: "sess-004",
            token: "token-noorg",
            targetUserId: "user-noorg",
            targetOrganizationId: "org-001",
            platformAdminId: "admin-001",
            status: "active",
            expiresAt: future,
        } as never);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user-noorg",
            email: "noorg@example.com",
            name: "No Org",
            role: "admin",
            organizationId: null,
        } as never);

        const result = await validateImpersonationToken("token-noorg");

        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/no longer exists|organization/i);
        expect(prisma.impersonationSession.update).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// c) bKash Multi-Tenant Cache Isolation
// ═══════════════════════════════════════════════════════════════════
//
// NOTE: the bKash token cache (`bkashTokenCache`) is a module-level Map
// that persists across tests in the same file. Each test below uses a
// UNIQUE org ID so prior-test cache hits can't mask the behaviour under
// test. Assertions are written as deltas (after − before) so absolute
// counts from prior tests don't pollute the assertions.

describe("[P0-SECURITY] bKash token cache is keyed by organizationId", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock = mockBkashFetchSuccess() as ReturnType<typeof vi.fn>;
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /** Count how many times the bKash token-grant endpoint was hit. */
    function tokenGrantCallCount(): number {
        return fetchMock.mock.calls.filter(([url]) =>
            (url as URL | string).toString().includes("/token/grant"),
        ).length;
    }

    it("token fetched for org A is reused on the second call for org A (cache hit)", async () => {
        const orgId = "org-CACHE-HIT"; // unique to this test
        setupDisbursementPrismaStubs(orgId, "slip-1");

        const before = tokenGrantCallCount();
        await disburseSalary({
            salarySlipId: "slip-1",
            channel: "bkash",
            organizationId: orgId,
            actorUserId: "user-1",
        });
        const afterFirst = tokenGrantCallCount();
        expect(afterFirst - before).toBe(1); // cache miss → fetch

        setupDisbursementPrismaStubs(orgId, "slip-2");
        await disburseSalary({
            salarySlipId: "slip-2",
            channel: "bkash",
            organizationId: orgId,
            actorUserId: "user-1",
        });
        const afterSecond = tokenGrantCallCount();
        expect(afterSecond - afterFirst).toBe(0); // cache hit → no fetch
    });

    it("token cached for org A is NOT returned for org B (tenant isolation)", async () => {
        const orgA = "org-ISO-A";
        const orgB = "org-ISO-B";

        setupDisbursementPrismaStubs(orgA, "slip-A");
        const before = tokenGrantCallCount();
        await disburseSalary({
            salarySlipId: "slip-A",
            channel: "bkash",
            organizationId: orgA,
            actorUserId: "user-A",
        });
        const afterA = tokenGrantCallCount();
        expect(afterA - before).toBe(1); // org A: cache miss → fetch

        setupDisbursementPrismaStubs(orgB, "slip-B");
        await disburseSalary({
            salarySlipId: "slip-B",
            channel: "bkash",
            organizationId: orgB,
            actorUserId: "user-B",
        });
        const afterB = tokenGrantCallCount();
        // CRITICAL: org B must NOT reuse org A's cached token.
        // If it did, this delta would be 0 and Tenant B would be running
        // disbursements authenticated as Tenant A.
        expect(afterB - afterA).toBe(1);
    });

    it("two organizations get independent cached tokens", async () => {
        const orgA = "org-IND-A";
        const orgB = "org-IND-B";

        // Warm cache for both orgs
        setupDisbursementPrismaStubs(orgA, "slip-A1");
        const before = tokenGrantCallCount();
        await disburseSalary({
            salarySlipId: "slip-A1",
            channel: "bkash",
            organizationId: orgA,
            actorUserId: "user-A",
        });
        setupDisbursementPrismaStubs(orgB, "slip-B1");
        await disburseSalary({
            salarySlipId: "slip-B1",
            channel: "bkash",
            organizationId: orgB,
            actorUserId: "user-B",
        });
        const afterWarm = tokenGrantCallCount();
        expect(afterWarm - before).toBe(2); // One fetch per org

        // Subsequent calls for both orgs should both be cache hits
        setupDisbursementPrismaStubs(orgA, "slip-A2");
        await disburseSalary({
            salarySlipId: "slip-A2",
            channel: "bkash",
            organizationId: orgA,
            actorUserId: "user-A",
        });
        setupDisbursementPrismaStubs(orgB, "slip-B2");
        await disburseSalary({
            salarySlipId: "slip-B2",
            channel: "bkash",
            organizationId: orgB,
            actorUserId: "user-B",
        });
        const afterReUse = tokenGrantCallCount();
        expect(afterReUse - afterWarm).toBe(0); // Both cache hits
    });

    it("does NOT call fetch at all when bKash is not configured for the org", async () => {
        const orgId = "org-NOCONFIG";
        vi.mocked(prisma.salarySlip.findFirst).mockResolvedValue({
            id: "slip-X",
            status: "approved",
            isLocked: false,
            netSalary: 5000,
            employee: { id: "emp-001", firstName: "Test", lastName: "User", email: "t@e.com" },
        } as never);
        // Empty settings — getBkashConfig returns null
        vi.mocked(prisma.organization.findUnique).mockResolvedValue({
            id: orgId,
            settings: {},
        } as never);
        vi.mocked(prisma.salaryDisbursement.create).mockResolvedValue({ id: "d-1" } as never);
        vi.mocked(prisma.salaryDisbursement.update).mockResolvedValue({} as never);

        const before = tokenGrantCallCount();
        await disburseSalary({
            salarySlipId: "slip-X",
            channel: "bkash",
            organizationId: orgId,
            actorUserId: "user-X",
        });
        const after = tokenGrantCallCount();
        expect(after - before).toBe(0); // No token grant call — config missing
    });
});

// ═══════════════════════════════════════════════════════════════════
// d) sessionVersion Increment on Role Change / Deactivation
// ═══════════════════════════════════════════════════════════════════

describe("[P0-SECURITY] sessionVersion increment on access changes", () => {
    // The route calls auth.withDB((db) => db.user.update(...)). withTenant
    // is mocked in setup.ts to invoke the callback directly with the prisma
    // mock, so auth.withDB === (fn) => fn(prisma) — same instance our test
    // asserts against.
    const mockAuth = {
        userId: "admin-001",
        role: "admin",
        organizationId: "org-001",
        email: "admin@example.com",
        withDB: async <T,>(fn: (db: unknown) => Promise<T>): Promise<T> => fn(prisma),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAuth).mockResolvedValue(mockAuth as never);
        vi.mocked(isAuthenticated).mockReturnValue(true);
    });

    it("increments sessionVersion when role is changed", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user-002",
            role: "employee",
            isActive: true,
            employee: { id: "emp-002" },
        } as never);
        vi.mocked(prisma.user.count).mockResolvedValue(2);
        vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user-002",
            role: "manager",
            isActive: true,
        } as never);

        const res = await patchUserAccess(
            makePatchRequest({ userId: "user-002", role: "manager" }),
        );

        expect(res.status).toBe(200);
        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "user-002" },
                data: expect.objectContaining({
                    role: "manager",
                    sessionVersion: { increment: 1 },
                }),
            }),
        );
    });

    it("increments sessionVersion when user is deactivated (isActive=false)", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user-003",
            role: "employee",
            isActive: true,
            employee: { id: "emp-003" },
        } as never);
        vi.mocked(prisma.user.count).mockResolvedValue(2);
        vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user-003",
            role: "employee",
            isActive: false,
        } as never);

        const res = await patchUserAccess(
            makePatchRequest({ userId: "user-003", isActive: false }),
        );

        expect(res.status).toBe(200);
        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "user-003" },
                data: expect.objectContaining({
                    isActive: false,
                    sessionVersion: { increment: 1 },
                }),
            }),
        );
    });

    it("does NOT increment sessionVersion when isActive=true and role is unchanged", async () => {
        // Per the fix: increment only when role changes OR isActive === false.
        // Setting isActive=true (no role) is a no-op for sessionVersion.
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user-004",
            role: "employee",
            isActive: true,
            employee: { id: "emp-004" },
        } as never);
        vi.mocked(prisma.user.count).mockResolvedValue(2);
        vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user-004",
            role: "employee",
            isActive: true,
        } as never);

        const res = await patchUserAccess(
            makePatchRequest({ userId: "user-004", isActive: true }),
        );

        expect(res.status).toBe(200);
        // The data object should NOT contain sessionVersion
        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "user-004" },
                data: expect.not.objectContaining({
                    sessionVersion: expect.anything(),
                }),
            }),
        );
    });

    it("refuses to deactivate the last remaining admin", async () => {
        // Target is the only active admin; deactivating would orphan the org.
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user-admin",
            role: "admin",
            isActive: true,
            employee: null,
        } as never);
        vi.mocked(prisma.user.count).mockResolvedValue(1); // Only 1 admin

        const res = await patchUserAccess(
            makePatchRequest({ userId: "user-admin", isActive: false }),
        );

        expect(res.status).toBe(400);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("refuses non-admin caller (Forbidden)", async () => {
        // Override the auth mock for this test only
        vi.mocked(requireAuth).mockResolvedValue({
            ...mockAuth,
            role: "employee",
        } as never);

        const res = await patchUserAccess(
            makePatchRequest({ userId: "user-002", role: "manager" }),
        );

        expect(res.status).toBe(403);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });
});
