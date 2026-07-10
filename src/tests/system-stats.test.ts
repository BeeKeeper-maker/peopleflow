/**
 * ═══════════════════════════════════════════════════════════════════
 * UNIT TESTS: /api/admin/system-stats (P10-TESTS)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Coverage for GET /api/admin/system-stats — the admin monitoring
 * endpoint added in P9. Verifies:
 *
 *   a) 401 when unauthenticated
 *   b) 403 when caller is a non-admin/HR role (e.g. employee)
 *   c) 200 + correct response shape when admin auth succeeds
 *   d) 500 when a DB count throws (outer try/catch)
 *   e) 200 (graceful degradation) when Redis is unavailable
 *
 * Determinism: @/lib/api-auth and @/lib/redis are mocked at the module
 * level. The prisma mock from src/tests/setup.ts intercepts every DB
 * call; auth.withDB is wired to invoke the callback directly with the
 * prisma mock so `db.employee.count` etc. resolve to the same vi.fn
 * instances we assert against.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @/lib/api-auth ────────────────────────────────────────────
// The route uses requireAdminOrHR + isAuthenticated. Other exports
// (requireAuth, requireRole, …) are stubbed so any code path that
// reaches them doesn't throw on a missing function.
vi.mock("@/lib/api-auth", () => ({
    requireAuth: vi.fn(),
    requireAdminOrHR: vi.fn(),
    requireRole: vi.fn(),
    requireEmployee: vi.fn(),
    requireManagerOrAbove: vi.fn(),
    // Mirrors the real isAuthenticated type guard: a NextResponse has a
    // numeric `status`, an AuthContext does not.
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

// ── Mock @/lib/redis ───────────────────────────────────────────────
// Factory only references vi.fn() so vitest can safely hoist it.
vi.mock("@/lib/redis", () => ({
    getRedis: vi.fn(),
    isRedisDisabledForRuntime: vi.fn(() => true),
    checkRedisRateLimit: vi.fn(),
}));

// ── Imports under test ─────────────────────────────────────────────
import { GET } from "@/app/api/admin/system-stats/route";
import prisma from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { getRedis, isRedisDisabledForRuntime } from "@/lib/redis";

// ═══════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════

/** AuthContext stub whose withDB invokes the callback with the prisma mock. */
const mockAdminAuth = {
    userId: "admin-001",
    email: "admin@example.com",
    role: "admin" as const,
    organizationId: "org-001",
    withDB: async <T,>(fn: (db: unknown) => Promise<T>): Promise<T> => fn(prisma),
};

/** Wire every prisma.count the route touches to deterministic values. */
function setupCountStubs(overrides: Partial<{
    totalEmployees: number;
    activeEmployees: number;
    attendanceToday: number;
    leaveApplications: number;
    pendingApprovals: number;
    salarySlips: number;
}> = {}) {
    vi.mocked(prisma.employee.count)
        .mockResolvedValueOnce(overrides.totalEmployees ?? 150)
        .mockResolvedValueOnce(overrides.activeEmployees ?? 140);
    vi.mocked(prisma.attendance.count)
        .mockResolvedValue(overrides.attendanceToday ?? 42);
    vi.mocked(prisma.leaveApplication.count)
        .mockResolvedValue(overrides.leaveApplications ?? 77);
    vi.mocked(prisma.approvalRequest.count)
        .mockResolvedValue(overrides.pendingApprovals ?? 13);
    vi.mocked(prisma.salarySlip.count)
        .mockResolvedValue(overrides.salarySlips ?? 300);
}

/** Build a mock Redis client with a configurable llen return value. */
function mockRedisClient(opts: { status?: string; llenValue?: number } = {}) {
    return {
        status: opts.status ?? "ready",
        llen: vi.fn().mockResolvedValue(opts.llenValue ?? 0),
    } as never;
}

// ═══════════════════════════════════════════════════════════════════
// a) + b) Authentication / authorization
// ═══════════════════════════════════════════════════════════════════

describe("[SYSTEM-STATS] authn / authz", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when the caller is unauthenticated", async () => {
        const unauth = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        vi.mocked(requireAdminOrHR).mockResolvedValue(unauth as never);
        vi.mocked(isAuthenticated).mockReturnValue(false);

        const res = await GET();

        expect(res.status).toBe(401);
        // Must not have queried any DB counters
        expect(prisma.employee.count).not.toHaveBeenCalled();
        expect(prisma.salarySlip.count).not.toHaveBeenCalled();
    });

    it("returns 403 when the caller is a non-admin employee", async () => {
        const forbidden = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        vi.mocked(requireAdminOrHR).mockResolvedValue(forbidden as never);
        vi.mocked(isAuthenticated).mockReturnValue(false);

        const res = await GET();

        expect(res.status).toBe(403);
        expect(prisma.employee.count).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// c) Admin happy path
// ═══════════════════════════════════════════════════════════════════

describe("[SYSTEM-STATS] admin happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminOrHR).mockResolvedValue(mockAdminAuth as never);
        vi.mocked(isAuthenticated).mockReturnValue(true);
        // Default: Redis disabled → queue depth block is skipped entirely
        vi.mocked(isRedisDisabledForRuntime).mockReturnValue(true);
        setupCountStubs();
    });

    it("returns 200 with database/redis/system top-level keys", async () => {
        const res = await GET();
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toHaveProperty("database");
        expect(body).toHaveProperty("redis");
        expect(body).toHaveProperty("system");
        expect(body).toHaveProperty("timestamp");
    });

    it("database object exposes all 6 stat counters from prisma.count calls", async () => {
        const res = await GET();
        const body = await res.json();

        expect(body.database).toEqual(
            expect.objectContaining({
                totalEmployees: 150,
                activeEmployees: 140,
                totalAttendanceToday: 42,
                totalLeaveApplications: 77,
                pendingApprovals: 13,
                totalSalarySlips: 300,
            }),
        );
    });

    it("queries employee.count twice — once for total, once for active filter", async () => {
        await GET();

        const calls = vi.mocked(prisma.employee.count).mock.calls;
        expect(calls).toHaveLength(2);

        // First call: total employees (no employmentStatus filter)
        expect(calls[0][0]).toEqual(
            expect.objectContaining({
                where: expect.objectContaining({
                    organizationId: "org-001",
                    deletedAt: null,
                }),
            }),
        );
        // Second call: active employees (employmentStatus:"active")
        expect(calls[1][0]).toEqual(
            expect.objectContaining({
                where: expect.objectContaining({
                    organizationId: "org-001",
                    employmentStatus: "active",
                }),
            }),
        );
    });

    it("queries pendingApprovals with status:'pending' filter", async () => {
        await GET();

        expect(prisma.approvalRequest.count).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    organizationId: "org-001",
                    status: "pending",
                }),
            }),
        );
    });

    it("redis object has connected (boolean) and queueDepth (number) fields", async () => {
        const res = await GET();
        const body = await res.json();

        expect(body.redis).toHaveProperty("connected");
        expect(body.redis).toHaveProperty("queueDepth");
        expect(typeof body.redis.connected).toBe("boolean");
        expect(typeof body.redis.queueDepth).toBe("number");
    });

    it("system object exposes uptime, memoryUsage (rss/heapUsed/heapTotal), nodeVersion, environment", async () => {
        const res = await GET();
        const body = await res.json();

        expect(body.system).toEqual(
            expect.objectContaining({
                uptime: expect.any(Number),
                nodeVersion: expect.any(String),
                environment: expect.any(String),
            }),
        );
        expect(body.system.memoryUsage).toEqual(
            expect.objectContaining({
                rss: expect.any(Number),
                heapUsed: expect.any(Number),
                heapTotal: expect.any(Number),
            }),
        );
    });

    it("does not call getRedis when isRedisDisabledForRuntime() is true", async () => {
        vi.mocked(isRedisDisabledForRuntime).mockReturnValue(true);

        await GET();

        expect(getRedis).not.toHaveBeenCalled();
    });

    it("queries Redis LLEN across 8 queues and sums depth when Redis is enabled", async () => {
        vi.mocked(isRedisDisabledForRuntime).mockReturnValue(false);
        vi.mocked(getRedis).mockReturnValue(mockRedisClient({ status: "ready", llenValue: 5 }));

        const res = await GET();
        const body = await res.json();

        // 8 queues × 5 jobs each = 40
        expect(body.redis.connected).toBe(true);
        expect(body.redis.queueDepth).toBe(40);
        expect(getRedis).toHaveBeenCalledTimes(1);
        const redisClient = vi.mocked(getRedis).mock.results[0]?.value as { llen: ReturnType<typeof vi.fn> };
        expect(redisClient.llen).toHaveBeenCalledTimes(8);
    });

    it("exposes timestamp as an ISO-8601 string", async () => {
        const res = await GET();
        const body = await res.json();

        expect(body.timestamp).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        );
        // Should be parseable as a real date
        expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
    });
});

// ═══════════════════════════════════════════════════════════════════
// d) + e) Error handling
// ═══════════════════════════════════════════════════════════════════

describe("[SYSTEM-STATS] error handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(requireAdminOrHR).mockResolvedValue(mockAdminAuth as never);
        vi.mocked(isAuthenticated).mockReturnValue(true);
        vi.mocked(isRedisDisabledForRuntime).mockReturnValue(true);
    });

    it("returns 500 when a DB count throws (outer try/catch swallows the error)", async () => {
        // Only the first employee.count call is reached — the route's outer
        // try/catch swallows the rejection and returns 500 immediately.
        // (Do NOT queue a second mockResolvedValueOnce here: it would leak
        // into the next test since vi.clearAllMocks() doesn't drain the
        // once-queue.)
        vi.mocked(prisma.employee.count).mockRejectedValueOnce(
            new Error("connection refused"),
        );
        vi.mocked(prisma.attendance.count).mockResolvedValue(0);
        vi.mocked(prisma.leaveApplication.count).mockResolvedValue(0);
        vi.mocked(prisma.approvalRequest.count).mockResolvedValue(0);
        vi.mocked(prisma.salarySlip.count).mockResolvedValue(0);

        const res = await GET();

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toMatch(/Failed to fetch system stats/i);
    });

    it("still returns 200 with redis.connected=false when Redis throws", async () => {
        vi.mocked(isRedisDisabledForRuntime).mockReturnValue(false);
        vi.mocked(getRedis).mockImplementation(() => {
            throw new Error("Redis connection refused");
        });
        setupCountStubs();

        const res = await GET();

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.redis.connected).toBe(false);
        expect(body.redis.queueDepth).toBe(0);
        // DB stats should still be populated
        expect(body.database.totalEmployees).toBe(150);
    });

    it("marks redis.connected=false when the client status is not 'ready'", async () => {
        vi.mocked(isRedisDisabledForRuntime).mockReturnValue(false);
        vi.mocked(getRedis).mockReturnValue(
            mockRedisClient({ status: "connecting", llenValue: 0 }),
        );
        setupCountStubs();

        const res = await GET();
        const body = await res.json();

        expect(body.redis.connected).toBe(false);
    });
});
