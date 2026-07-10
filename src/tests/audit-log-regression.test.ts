/**
 * ═══════════════════════════════════════════════════════════════════
 * AUDIT LOG REGRESSION TESTS (P12-AUDIT-STORAGE)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Verifies that the P11-AUDIT-LOG telemetry actually fires for each
 * sensitive action, AND that the P12 manager direct-report PII audit
 * extension works. Without these tests, a future refactor could
 * silently drop the `createAuditLog(...)` call from any route and
 * the only signal would be missing entries in the audit-log UI —
 * which nobody looks at until a breach is already under
 * investigation.
 *
 * Coverage:
 *   a) 2FA disable      → action "2fa.disabled"
 *   b) Role change      → action "role.changed" + old/new role
 *   c) HR PII access    → action "pii.accessed" (HR viewing employee)
 *   d) bKash creds save → action "bkash.credentials_updated"
 *   e) Self-view        → "pii.accessed" MUST NOT fire
 *   f) Manager direct-report PII access → action "pii.accessed"
 *      (P12-AUDIT-STORAGE extension; previously un-logged)
 *
 * Mocking strategy mirrors p0-security-regression.test.ts: every
 * external module is hoisted via `vi.mock`, the prisma client is
 * the global mock from setup.ts, and `createAuditLog` is stubbed
 * with a vi.fn so we can assert call args.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mocks (hoisted by vitest) ────────────────────────────────

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
    // employees/[id] GET calls decryptEmployeePhoneNumbers(employee) on the
    // way out. Pass-through so the response shape is preserved.
    decryptEmployeePhoneNumbers: vi.fn(<T>(employee: T): T => employee),
}));

vi.mock("@/lib/crypto", () => ({
    decrypt: vi.fn((v: string) => v),
    encrypt: vi.fn((v: string) => v),
    isEncrypted: vi.fn(() => false),
}));

vi.mock("@/lib/email", () => ({
    sendTemplateEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/event-bus", () => ({
    emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rate-limit", () => ({
    rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    RATE_LIMIT_CONFIGS: { read: {}, heavy: {}, write: {} },
}));

// 2FA route does `await import("bcryptjs")` and uses `bcrypt.compare`.
vi.mock("bcryptjs", () => {
    const compare = vi.fn();
    const hash = vi.fn();
    return {
        default: { compare, hash },
        compare,
        hash,
    };
});

// 2FA route does `await import("otplib")` and destructures `verify`.
vi.mock("otplib", () => {
    const verify = vi.fn();
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

vi.mock("qrcode", () => ({
    default: {
        toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,MOCK"),
    },
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,MOCK"),
}));

vi.mock("@/lib/recovery-codes", () => ({
    verifyRecoveryCode: vi.fn().mockResolvedValue(null),
    generateRecoveryCodes: vi.fn().mockResolvedValue({ plaintext: [], hashes: [] }),
    getRemainingCodeCount: vi.fn(() => 0),
    shouldWarnLowCodes: vi.fn(() => false),
}));

// ── Imports under test ─────────────────────────────────────────────
import { DELETE as delete2FA } from "@/app/api/auth/2fa/setup/route";
import { PATCH as patchUserAccess } from "@/app/api/access/users/route";
import { GET as getEmployee } from "@/app/api/employees/[id]/route";
import { PATCH as patchSettings } from "@/app/api/settings/route";
import prisma from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { createAuditLog } from "@/lib/audit-log";
import bcrypt from "bcryptjs";
import * as otplib from "otplib";

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function make2faDeleteRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/auth/2fa/setup", {
        method: "DELETE",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

function makeAccessPatchRequest(body: unknown): Request {
    return new Request("http://localhost/api/access/users", {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

function makeSettingsPatchRequest(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/settings", {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

function makeEmployeeGetRequest(): Request {
    return new Request("http://localhost/api/employees/emp-target", {
        method: "GET",
    });
}

/** Build a successful auth context with withDB wired to the prisma mock. */
function makeAuthContext(overrides: Partial<{
    userId: string;
    email: string;
    role: "super_admin" | "admin" | "hr_admin" | "manager" | "employee";
    organizationId: string;
    employeeId?: string;
}> = {}) {
    return {
        userId: overrides.userId ?? "actor-001",
        email: overrides.email ?? "actor@example.com",
        role: overrides.role ?? "admin",
        organizationId: overrides.organizationId ?? "org-001",
        ...(overrides.employeeId !== undefined ? { employeeId: overrides.employeeId } : {}),
        withDB: async <T,>(fn: (db: unknown) => Promise<T>): Promise<T> => fn(prisma),
    };
}

const SAMPLE_EMPLOYEE = {
    id: "emp-target",
    organizationId: "org-001",
    firstName: "Target",
    lastName: "Employee",
    email: "target@example.com",
    phone: "01711111111",
    bkashNumber: "01711111111",
    nagadNumber: "01811111111",
    nidNumber: "1234567890123",
    department: { id: "dept-1", name: "Engineering" },
    designation: { id: "desig-1", name: "Engineer" },
    shift: null,
    branch: null,
    reportingManager: null,
    salaryAssignments: [],
};

// ═══════════════════════════════════════════════════════════════════
// a) 2FA disable calls audit log with action "2fa.disabled"
// ═══════════════════════════════════════════════════════════════════

describe("[AUDIT-LOG] 2FA disable fires audit log", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it("calls createAuditLog with action '2fa.disabled' after a successful disable", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user-001",
            password: "$2a$12$hashed",
            twoFactorSecret: "secret",
            twoFactorEnabled: true,
            twoFactorRecoveryCodes: [],
        } as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
        vi.mocked(otplib.verify).mockResolvedValue({
            valid: true, delta: 0, epoch: 0, timeStep: 0,
        } as never);
        vi.mocked(prisma.user.update).mockResolvedValue({ id: "user-001" } as never);

        const res = await delete2FA(
            make2faDeleteRequest({ currentPassword: "correct-password", totpCode: "123456" }),
        );

        expect(res.status).toBe(200);
        expect(vi.mocked(createAuditLog)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "2fa.disabled",
                entityType: "User",
                entityId: "user-001",
                userId: "user-001",
                organizationId: "org-001",
                oldValues: expect.objectContaining({ twoFactorEnabled: true }),
                newValues: expect.objectContaining({ twoFactorEnabled: false }),
            }),
        );
    });

    it("does NOT call audit log when 2FA disable fails (wrong password)", async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: "user-001",
            password: "$2a$12$hashed",
            twoFactorSecret: "secret",
            twoFactorEnabled: true,
            twoFactorRecoveryCodes: [],
        } as never);
        vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

        const res = await delete2FA(
            make2faDeleteRequest({ currentPassword: "wrong-password", totpCode: "123456" }),
        );

        expect(res.status).toBe(403);
        expect(vi.mocked(createAuditLog)).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// b) Role change calls audit log with action "role.changed"
// ═══════════════════════════════════════════════════════════════════

describe("[AUDIT-LOG] role change fires audit log", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAuth).mockResolvedValue(makeAuthContext({ role: "admin" }) as never);
        vi.mocked(isAuthenticated).mockReturnValue(true);
    });

    it("calls createAuditLog with action 'role.changed' and old/new role values", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user-target",
            role: "employee",
            isActive: true,
            employee: { id: "emp-target" },
        } as never);
        vi.mocked(prisma.user.count).mockResolvedValue(2);
        vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user-target",
            role: "manager",
            isActive: true,
        } as never);

        const res = await patchUserAccess(
            makeAccessPatchRequest({ userId: "user-target", role: "manager" }),
        );

        expect(res.status).toBe(200);
        expect(vi.mocked(createAuditLog)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "role.changed",
                entityType: "User",
                entityId: "user-target",
                userId: "actor-001",
                organizationId: "org-001",
                oldValues: { role: "employee" },
                newValues: { role: "manager" },
            }),
        );
    });

    it("does NOT call audit log when role is unchanged (only isActive flip)", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user-target",
            role: "employee",
            isActive: true,
            employee: { id: "emp-target" },
        } as never);
        vi.mocked(prisma.user.count).mockResolvedValue(2);
        vi.mocked(prisma.user.update).mockResolvedValue({
            id: "user-target",
            role: "employee",
            isActive: true,
        } as never);

        const res = await patchUserAccess(
            makeAccessPatchRequest({ userId: "user-target", isActive: true }),
        );

        expect(res.status).toBe(200);
        expect(vi.mocked(createAuditLog)).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// c) HR/admin PII access calls audit log with action "pii.accessed"
// ═══════════════════════════════════════════════════════════════════

describe("[AUDIT-LOG] HR/admin PII access fires audit log", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Admin viewing someone else's profile
        vi.mocked(requireAuth).mockResolvedValue(
            makeAuthContext({
                role: "admin",
                userId: "admin-001",
                employeeId: "admin-emp-001",
            }) as never,
        );
        vi.mocked(isAuthenticated).mockReturnValue(true);
    });

    it("calls createAuditLog with action 'pii.accessed' when admin views an employee", async () => {
        vi.mocked(prisma.employee.findFirst).mockResolvedValue(SAMPLE_EMPLOYEE as never);

        const res = await getEmployee(makeEmployeeGetRequest(), {
            params: Promise.resolve({ id: "emp-target" }),
        });

        expect(res.status).toBe(200);
        expect(vi.mocked(createAuditLog)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "pii.accessed",
                entityType: "Employee",
                entityId: "emp-target",
                userId: "admin-001",
                organizationId: "org-001",
                newValues: expect.objectContaining({
                    fields: ["bkashNumber", "nagadNumber", "nidNumber"],
                }),
            }),
        );
    });

    it("does NOT call audit log when employee is not found (404)", async () => {
        vi.mocked(prisma.employee.findFirst).mockResolvedValue(null as never);

        const res = await getEmployee(makeEmployeeGetRequest(), {
            params: Promise.resolve({ id: "emp-missing" }),
        });

        expect(res.status).toBe(404);
        expect(vi.mocked(createAuditLog)).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// d) bKash credential save calls audit log
//     with action "bkash.credentials_updated"
// ═══════════════════════════════════════════════════════════════════

describe("[AUDIT-LOG] bKash credential save fires audit log", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminOrHR).mockResolvedValue(
            makeAuthContext({ role: "hr_admin", userId: "hr-001" }) as never,
        );
        vi.mocked(isAuthenticated).mockReturnValue(true);
    });

    it("calls createAuditLog with action 'bkash.credentials_updated' on save", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue({
            id: "org-001",
            settings: {},
        } as never);
        vi.mocked(prisma.organization.update).mockResolvedValue({
            id: "org-001",
            name: "Test Org",
        } as never);

        const res = await patchSettings(
            makeSettingsPatchRequest({
                name: "Test Org",
                bkashConfig: {
                    appKey: "test-app-key",
                    appSecret: "test-app-secret",
                    username: "test-user",
                    password: "test-pass",
                    sandbox: true,
                },
            }),
        );

        expect(res.status).toBe(200);
        expect(vi.mocked(createAuditLog)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "bkash.credentials_updated",
                entityType: "Organization",
                entityId: "org-001",
                userId: "hr-001",
                organizationId: "org-001",
            }),
        );
    });

    it("does NOT call audit log when bKash credentials are not part of the PATCH", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue({
            id: "org-001",
            settings: {},
        } as never);
        vi.mocked(prisma.organization.update).mockResolvedValue({
            id: "org-001",
            name: "Renamed Org",
        } as never);

        const res = await patchSettings(
            makeSettingsPatchRequest({ name: "Renamed Org" }),
        );

        expect(res.status).toBe(200);
        expect(vi.mocked(createAuditLog)).not.toHaveBeenCalled();
    });

    it("does NOT call audit log when bKash config is rejected (missing fields)", async () => {
        vi.mocked(prisma.organization.findUnique).mockResolvedValue({
            id: "org-001",
            settings: {},
        } as never);

        const res = await patchSettings(
            makeSettingsPatchRequest({
                bkashConfig: {
                    appKey: "only-app-key",
                    // missing appSecret, username, password
                },
            }),
        );

        expect(res.status).toBe(400);
        expect(vi.mocked(createAuditLog)).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// e) Self-view does NOT call PII audit
// ═══════════════════════════════════════════════════════════════════

describe("[AUDIT-LOG] self-view does NOT fire PII audit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Employee viewing their OWN profile — employeeId === target id
        vi.mocked(requireAuth).mockResolvedValue(
            makeAuthContext({
                role: "employee",
                userId: "self-001",
                employeeId: "emp-self",
            }) as never,
        );
        vi.mocked(isAuthenticated).mockReturnValue(true);
    });

    it("does NOT call createAuditLog with 'pii.accessed' when employee views own profile", async () => {
        vi.mocked(prisma.employee.findFirst).mockResolvedValue({
            ...SAMPLE_EMPLOYEE,
            id: "emp-self",
        } as never);

        const res = await getEmployee(
            new Request("http://localhost/api/employees/emp-self", { method: "GET" }),
            { params: Promise.resolve({ id: "emp-self" }) },
        );

        expect(res.status).toBe(200);
        // The defining invariant: an employee reading their own PII is
        // NOT a third-party access, so the audit log must stay silent.
        const piiCalls = vi.mocked(createAuditLog).mock.calls.filter(
            ([entry]) => (entry as { action?: string }).action === "pii.accessed",
        );
        expect(piiCalls).toHaveLength(0);
        expect(vi.mocked(createAuditLog)).not.toHaveBeenCalledWith(
            expect.objectContaining({ action: "pii.accessed" }),
        );
    });
});

// ═══════════════════════════════════════════════════════════════════
// f) Manager direct-report PII access calls audit log (P12 extension)
// ═══════════════════════════════════════════════════════════════════

describe("[AUDIT-LOG] manager direct-report PII access fires audit log (P12)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Manager viewing a direct report's profile
        vi.mocked(requireAuth).mockResolvedValue(
            makeAuthContext({
                role: "manager",
                userId: "mgr-001",
                employeeId: "mgr-emp-001",
            }) as never,
        );
        vi.mocked(isAuthenticated).mockReturnValue(true);
    });

    it("calls createAuditLog with 'pii.accessed' + accessContext 'manager_direct_report'", async () => {
        // First prisma.employee.findFirst call: direct-report check (returns truthy → isDirectReport=true)
        // Second call: full employee fetch. Same mock, both return a value.
        vi.mocked(prisma.employee.findFirst).mockResolvedValue(SAMPLE_EMPLOYEE as never);

        const res = await getEmployee(makeEmployeeGetRequest(), {
            params: Promise.resolve({ id: "emp-target" }),
        });

        expect(res.status).toBe(200);
        expect(vi.mocked(createAuditLog)).toHaveBeenCalledWith(
            expect.objectContaining({
                action: "pii.accessed",
                entityType: "Employee",
                entityId: "emp-target",
                userId: "mgr-001",
                organizationId: "org-001",
                newValues: expect.objectContaining({
                    fields: ["bkashNumber", "nagadNumber", "nidNumber"],
                    accessContext: "manager_direct_report",
                }),
            }),
        );
    });

    it("does NOT call audit log when manager views a non-report employee (no PII access)", async () => {
        // First call (direct-report check) returns null — emp-target is NOT a direct report.
        // The if (isHRLevel || isDirectReport || isSelf) branch is skipped entirely,
        // so the audit log must NOT fire.
        vi.mocked(prisma.employee.findFirst).mockResolvedValue(null as never);

        const res = await getEmployee(
            new Request("http://localhost/api/employees/emp-other", { method: "GET" }),
            { params: Promise.resolve({ id: "emp-other" }) },
        );

        // Either 404 (not found) or 200 (public fields). Either way, no PII audit log.
        expect([200, 404]).toContain(res.status);
        expect(vi.mocked(createAuditLog)).not.toHaveBeenCalledWith(
            expect.objectContaining({ action: "pii.accessed" }),
        );
    });
});
