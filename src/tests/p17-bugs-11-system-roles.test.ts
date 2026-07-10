/**
 * ═══════════════════════════════════════════════════════════════════
 * REGRESSION TESTS — P17 BUG 11
 * ═══════════════════════════════════════════════════════════════════
 *
 * PATCH /api/rbac/roles/[id] must reject permission modifications on
 * system core roles (isSystem=true) so a malicious/accidental admin
 * cannot strip critical invariants like "admin can always view employees"
 * and lock the tenant out of recovery paths. Cosmetic edits (name,
 * description, color) remain permitted.
 *
 * Determinism: every DB call is intercepted via a local prisma mock;
 * @/lib/rbac-v2 is stubbed so requirePermission resolves to a synthetic
 * admin AuthContext without going through the real permission engine.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ────────────────────────────────────────────────────
const { prismaMock } = vi.hoisted(() => {
    const prismaMock = {
        role: {
            findFirst: vi.fn(),
        },
        rolePermission: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
        permission: {
            findMany: vi.fn(),
        },
        userRoleAssignment: {
            findMany: vi.fn(),
        },
        role_update: vi.fn(),
    };
    return { prismaMock };
});

vi.mock("@/lib/prisma", () => ({
    default: prismaMock,
    prisma: prismaMock,
    withTenant: vi.fn(<T>(_orgId: string, fn: (db: unknown) => Promise<T>) => fn(prismaMock)),
    withPlatform: vi.fn(<T>(fn: (db: unknown) => Promise<T>) => fn(prismaMock)),
}));

vi.mock("@/lib/logger", () => {
    const noop = {
        info: vi.fn(), warn: vi.fn(), error: vi.fn(),
        debug: vi.fn(), fatal: vi.fn(),
        child: vi.fn(() => noop),
    };
    return {
        log: noop, payrollLogger: noop, authLogger: noop, queueLogger: noop,
        billingLogger: noop, biometricLogger: noop, platformLogger: noop,
        subscriptionLogger: noop, attendanceLogger: noop, emailLogger: noop,
        redisLogger: noop, eventLogger: noop, apiLogger: noop, auditLogger: noop,
        cronLogger: noop, storageLogger: noop, exportLogger: noop, leaveLogger: noop,
        createRequestLogger: vi.fn(() => noop),
    };
});

vi.mock("@/lib/audit-log", () => ({
    createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ── rbac-v2 stub: requirePermission returns a synthetic admin context ──
// We must NOT mock hasEffectivePermission / invalidatePermissionCache
// here because the route only dynamically imports `invalidatePermissionCache`
// (and requirePermission at the top). The stub below covers both.
const { rbacStub } = vi.hoisted(() => ({
    rbacStub: {
        requirePermission: vi.fn(),
        invalidatePermissionCache: vi.fn().mockResolvedValue(undefined),
    },
}));
vi.mock("@/lib/rbac-v2", () => ({
    requirePermission: rbacStub.requirePermission,
    invalidatePermissionCache: rbacStub.invalidatePermissionCache,
    __esModule: true,
}));

// ── Imports under test ─────────────────────────────────────────────
import { PATCH } from "@/app/api/rbac/roles/[id]/route";

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function patchReq(body: unknown): Request {
    return new Request("http://localhost/api/rbac/roles/role-1", {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });
}

const authedContext = {
    userId: "u-admin",
    organizationId: "org-1",
    role: "admin" as const,
    withDB: async <T>(fn: (db: unknown) => Promise<T>) => fn(prismaMock),
};

// The PATCH route's `auth.withDB(async (db) => {...})` callback receives
// the prisma mock directly. Stub `role.update` on the mock so the route's
// `db.role.update(...)` call resolves cleanly.
(prismaMock as unknown as { role: { update: ReturnType<typeof vi.fn> } }).role.update = vi.fn().mockResolvedValue({ id: "role-1", name: "Updated" });

beforeEach(() => {
    vi.clearAllMocks();
    rbacStub.requirePermission.mockResolvedValue(authedContext);
    rbacStub.invalidatePermissionCache.mockResolvedValue(undefined);
    // Default: no users are assigned to the role under test — keeps the
    // cache-invalidation loop at the end of PATCH from throwing on
    // `for (const a of undefined)`.
    prismaMock.userRoleAssignment.findMany.mockResolvedValue([]);
    (prismaMock as unknown as { role: { update: ReturnType<typeof vi.fn> } }).role.update.mockResolvedValue({
        id: "role-1",
        name: "Updated",
    });
});

// ═══════════════════════════════════════════════════════════════════
// 11) System role protection
// ═══════════════════════════════════════════════════════════════════

describe("[P17-BUGS-11] PATCH /api/rbac/roles/[id] system role protection", () => {
    it("rejects permission modifications on system roles with 403", async () => {
        prismaMock.role.findFirst.mockResolvedValue({
            id: "role-sys",
            name: "Admin",
            slug: "admin",
            isSystem: true,
            description: null,
            color: null,
            rolePermissions: [{ id: "rp-1" }],
        });

        const res = await PATCH(
            patchReq({ permissions: [{ permissionId: "p-1", scope: "global" }] }),
            { params: Promise.resolve({ id: "role-sys" }) },
        );

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.code).toBe("SYSTEM_ROLE_PERMISSIONS_LOCKED");
        expect(body.error).toMatch(/system roles cannot be modified/i);

        // And no destructive writes happened
        expect(prismaMock.rolePermission.deleteMany).not.toHaveBeenCalled();
        expect(prismaMock.rolePermission.createMany).not.toHaveBeenCalled();
    });

    it("allows cosmetic edits (name only) on a system role", async () => {
        prismaMock.role.findFirst.mockResolvedValue({
            id: "role-sys",
            name: "Admin",
            slug: "admin",
            isSystem: true,
            description: null,
            color: null,
            rolePermissions: [],
        });
        (prismaMock as unknown as { role: { update: ReturnType<typeof vi.fn> } }).role.update.mockResolvedValue({
            id: "role-sys",
            name: "Administrator",
        });

        const res = await PATCH(
            patchReq({ name: "Administrator" }),
            { params: Promise.resolve({ id: "role-sys" }) },
        );

        expect(res.status).toBe(200);
    });

    it("allows full permission edits on a custom (non-system) role", async () => {
        prismaMock.role.findFirst.mockResolvedValue({
            id: "role-custom",
            name: "Custom",
            slug: "custom",
            isSystem: false,
            description: null,
            color: null,
            rolePermissions: [],
        });
        prismaMock.permission.findMany.mockResolvedValue([{ id: "p-1" }]);
        prismaMock.rolePermission.deleteMany.mockResolvedValue({ count: 0 });
        prismaMock.rolePermission.createMany.mockResolvedValue({ count: 1 });
        prismaMock.userRoleAssignment.findMany.mockResolvedValue([]);

        const res = await PATCH(
            patchReq({ permissions: [{ permissionId: "p-1", scope: "global" }] }),
            { params: Promise.resolve({ id: "role-custom" }) },
        );

        expect(res.status).toBe(200);
        expect(prismaMock.rolePermission.deleteMany).toHaveBeenCalled();
        expect(prismaMock.rolePermission.createMany).toHaveBeenCalled();
    });

    it("returns 404 when the role does not exist", async () => {
        prismaMock.role.findFirst.mockResolvedValue(null);

        const res = await PATCH(
            patchReq({ name: "Whatever" }),
            { params: Promise.resolve({ id: "missing" }) },
        );

        expect(res.status).toBe(404);
    });
});
