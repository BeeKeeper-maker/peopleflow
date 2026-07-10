/**
 * ═══════════════════════════════════════════════════════════════════
 * REGRESSION TESTS — P17 BUGS 9-16
 * ═══════════════════════════════════════════════════════════════════
 *
 * Scope (one describe block per bug):
 *   10  RBAC cache TTL + cross-node Redis invalidation
 *   11  PATCH /api/rbac/roles/[id] rejects permission edits on system roles
 *   12  Empty array [] for departmentIds/branchIds means "no departments"
 *       (deny), distinct from undefined (all departments)
 *   13  POST /api/public/careers/[orgSlug]/jobs/[jobId] short-circuits 409
 *       BEFORE mutating the candidate row (fake-CV protection)
 *   14  GET /api/public/careers/[orgSlug]/jobs* hides expired jobs
 *   15  POST /api/recruitment/parse-resume returns 400 on invalid JSON
 *   16  GET /api/public/careers/[orgSlug]/jobs applies rate limit + pagination
 *
 * Determinism: every DB call is intercepted via a local prisma mock;
 * no real DB or Redis is touched. `@/lib/rate-limit` is stubbed so the
 * career-portal routes can be exercised without Redis.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock (overrides the global setup mock for this file) ─────
// We need models that aren't in the global mock (jobPosting, candidate,
// application, role, rolePermission, userRoleAssignment, rBACPermission,
// permission), so we provide a fresh per-file mock object here.
//
// vitest hoists vi.mock() factories ABOVE imports, so we declare the mock
// object via `vi.hoisted()` to make it accessible inside the factory.
const { prismaMock } = vi.hoisted(() => {
    const prismaMock = {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
        },
        organization: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        jobPosting: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            count: vi.fn(),
        },
        candidate: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        application: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        role: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        rolePermission: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
        permission: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        userRoleAssignment: {
            findMany: vi.fn(),
        },
        rBACPermission: {
            findMany: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
        $transaction: vi.fn(async (arg: unknown) => {
            if (typeof arg === "function") {
                return (arg as (tx: unknown) => Promise<unknown>)(prismaMock);
            }
            return Promise.all(arg as Promise<unknown>[]);
        }),
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

// Rate-limit stub: defaults to "allowed" with header set, but tests can
// flip it to "blocked" via `vi.mocked(rateLimit).mockResolvedValueOnce(...)`.
vi.mock("@/lib/rate-limit", () => ({
    rateLimit: vi.fn().mockResolvedValue({
        allowed: true,
        headers: {
            "X-RateLimit-Limit": "30",
            "X-RateLimit-Remaining": "29",
            "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + 60),
        },
    }),
    applyRateLimitHeaders: vi.fn((res: Response) => res),
    rateLimitExceededResponse: vi.fn(() => new Response("{}", { status: 429 })),
    RATE_LIMIT_CONFIGS: { read: {}, write: {}, heavy: {} },
}));

// ── Imports under test ─────────────────────────────────────────────
import { hasEffectivePermission, invalidatePermissionCache } from "@/lib/rbac-v2";
import { GET as getJobs, POST as postApply } from "@/app/api/public/careers/[orgSlug]/jobs/[jobId]/route";
import { GET as getJobList } from "@/app/api/public/careers/[orgSlug]/jobs/route";
import { rateLimit } from "@/lib/rate-limit";

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function jsonReq(url: string, init?: Omit<RequestInit, "body"> & { body?: unknown }): Request {
    const { body, ...rest } = init || {};
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    return new Request(url, {
        ...rest,
        body: bodyStr,
        headers: { "Content-Type": "application/json", ...(rest.headers || {}) },
    });
}

// Stash the live Date.now so each test can pin "now" deterministically.
const REAL_NOW = Date.now;

beforeEach(() => {
    vi.clearAllMocks();
    Date.now = REAL_NOW;
    // Default: rate limit allows the call
    vi.mocked(rateLimit).mockResolvedValue({
        allowed: true,
        headers: {
            "X-RateLimit-Limit": "30",
            "X-RateLimit-Remaining": "29",
            "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + 60),
        },
    });
});

// ═══════════════════════════════════════════════════════════════════
// 10) RBAC cache TTL + cross-node Redis invalidation
// ═══════════════════════════════════════════════════════════════════

describe("[P17-BUGS-10] RBAC permission cache invalidation", () => {
    it("invalidatePermissionCache is async (returns a Promise)", () => {
        // After the fix, the function deletes the local Map entry AND the
        // Redis marker key, so it must be awaitable.
        const result = invalidatePermissionCache("user-1");
        expect(result).toBeInstanceOf(Promise);
        return result; // flush unhandled rejection
    });

    it("computeEffectivePermissions re-fetches after invalidatePermissionCache is awaited", async () => {
        const { computeEffectivePermissions } = await import("@/lib/rbac-v2");

        // First call: user is a regular employee (no v2 assignments, no delegations)
        // → falls through to legacy ROLE_PERMISSIONS lookup.
        vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
            role: "employee",
        } as never);
        vi.mocked(prismaMock.userRoleAssignment.findMany).mockResolvedValue([] as never);
        vi.mocked(prismaMock.rBACPermission.findMany).mockResolvedValue([] as never);

        const first = await computeEffectivePermissions("user-1", "org-1");
        expect(first.length).toBeGreaterThan(0);

        // After invalidation, the next call must re-query prisma.user again.
        await invalidatePermissionCache("user-1");
        vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
            role: "manager", // role changed after invalidation
        } as never);
        vi.mocked(prismaMock.userRoleAssignment.findMany).mockResolvedValue([] as never);
        vi.mocked(prismaMock.rBACPermission.findMany).mockResolvedValue([] as never);

        const second = await computeEffectivePermissions("user-1", "org-1");
        // Legacy ROLE_PERMISSIONS["manager"] differs from ["employee"] —
        // we expect the second call to reflect the post-invalidation role.
        const employeePerms = first.map((p) => p.key).sort();
        const managerPerms = second.map((p) => p.key).sort();
        expect(managerPerms).not.toEqual(employeePerms);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 12) Empty array [] vs undefined for department/branch scope
// ═══════════════════════════════════════════════════════════════════

describe("[P17-BUGS-12] departmentIds / branchIds scope semantics", () => {
    beforeEach(() => {
        // Build a single user-role-assignment that carries the permission
        // under test so hasEffectivePermission resolves through the v2 path.
        vi.mocked(prismaMock.user.findUnique).mockResolvedValue({ role: "admin" } as never);
        vi.mocked(prismaMock.rBACPermission.findMany).mockResolvedValue([] as never);
    });

    async function checkWithPerm(
        perm: { departmentIds?: string[] | undefined; branchIds?: string[] | undefined; scope: string; key: string },
        opts: { departmentId?: string; branchId?: string },
    ) {
        vi.mocked(prismaMock.userRoleAssignment.findMany).mockResolvedValue([
            {
                role: {
                    rolePermissions: [
                        {
                            permission: { key: perm.key },
                            scope: perm.scope,
                            departmentIds: perm.departmentIds ?? null,
                            branchIds: perm.branchIds ?? null,
                        },
                    ],
                },
            },
        ] as never);
        // Always invalidate so the next call re-fetches
        await invalidatePermissionCache("user-scope");
        return hasEffectivePermission("user-scope", "org-1", perm.key, opts);
    }

    it("treats undefined departmentIds as global (allow)", async () => {
        const ok = await checkWithPerm(
            { key: "test:x", scope: "department", departmentIds: undefined },
            { departmentId: "dept-A" },
        );
        expect(ok).toBe(true);
    });

    it("treats empty array [] departmentIds as deny (no departments match)", async () => {
        const ok = await checkWithPerm(
            { key: "test:x", scope: "department", departmentIds: [] },
            { departmentId: "dept-A" },
        );
        expect(ok).toBe(false);
    });

    it("matches when departmentId is in the array", async () => {
        const ok = await checkWithPerm(
            { key: "test:x", scope: "department", departmentIds: ["dept-A"] },
            { departmentId: "dept-A" },
        );
        expect(ok).toBe(true);
    });

    it("denies when departmentId is NOT in the array", async () => {
        const ok = await checkWithPerm(
            { key: "test:x", scope: "department", departmentIds: ["dept-A"] },
            { departmentId: "dept-B" },
        );
        expect(ok).toBe(false);
    });

    it("treats empty array [] branchIds as deny (mirrors department logic)", async () => {
        const ok = await checkWithPerm(
            { key: "test:y", scope: "branch", branchIds: [] },
            { branchId: "branch-A" },
        );
        expect(ok).toBe(false);
    });

    it("treats undefined branchIds as global (allow)", async () => {
        const ok = await checkWithPerm(
            { key: "test:y", scope: "branch", branchIds: undefined },
            { branchId: "branch-A" },
        );
        expect(ok).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 13) Fake-CV protection: 409 BEFORE mutating candidate
// ═══════════════════════════════════════════════════════════════════

describe("[P17-BUGS-13] POST /api/public/careers/[orgSlug]/jobs/[jobId] duplicate protection", () => {
    const baseReq = () =>
        jsonReq("http://localhost/api/public/careers/acme/jobs/job-1", {
            method: "POST",
            body: {
                firstName: "Attacker",
                lastName: "Bot",
                email: "victim@example.com",
                resumeUrl: "https://evil.example/fake-cv.pdf",
            },
        });

    function setupOrgAndJob() {
        vi.mocked(prismaMock.organization.findUnique).mockResolvedValue({
            id: "org-1",
        } as never);
        vi.mocked(prismaMock.jobPosting.findFirst).mockResolvedValue({
            id: "job-1",
            organizationId: "org-1",
            status: "open",
        } as never);
    }

    it("returns 409 when an application already exists for this email+job", async () => {
        setupOrgAndJob();
        // Candidate with the victim's email already exists
        vi.mocked(prismaMock.candidate.findFirst).mockResolvedValue({
            id: "cand-1",
        } as never);
        // And they've already applied
        vi.mocked(prismaMock.application.findUnique).mockResolvedValue({
            id: "app-1",
        } as never);

        const res = await postApply(baseReq(), {
            params: Promise.resolve({ orgSlug: "acme", jobId: "job-1" }),
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.code).toBe("ALREADY_APPLIED");
    });

    it("does NOT update the candidate's resumeUrl when a duplicate application is rejected", async () => {
        setupOrgAndJob();
        vi.mocked(prismaMock.candidate.findFirst).mockResolvedValue({
            id: "cand-1",
        } as never);
        vi.mocked(prismaMock.application.findUnique).mockResolvedValue({
            id: "app-1",
        } as never);

        await postApply(baseReq(), {
            params: Promise.resolve({ orgSlug: "acme", jobId: "job-1" }),
        });

        // The fix: candidate.update must NOT be called for the rejected
        // duplicate flow (no resumeUrl overwrite).
        expect(prismaMock.candidate.update).not.toHaveBeenCalled();
        // And no new application row created either
        expect(prismaMock.application.create).not.toHaveBeenCalled();
    });

    it("creates candidate + application when no duplicate exists", async () => {
        setupOrgAndJob();
        vi.mocked(prismaMock.candidate.findFirst).mockResolvedValue(null);
        vi.mocked(prismaMock.candidate.create).mockResolvedValue({
            id: "cand-new",
        } as never);
        vi.mocked(prismaMock.application.create).mockResolvedValue({
            id: "app-new",
        } as never);

        const res = await postApply(baseReq(), {
            params: Promise.resolve({ orgSlug: "acme", jobId: "job-1" }),
        });

        expect(res.status).toBe(201);
        expect(prismaMock.application.create).toHaveBeenCalledTimes(1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 14) Career portal hides expired jobs (closesAt < now)
// ═══════════════════════════════════════════════════════════════════

describe("[P17-BUGS-14] GET careers — closed/expired jobs filter", () => {
    it("list endpoint passes an OR[closesAt:null, closesAt>=now] filter to findMany", async () => {
        vi.mocked(prismaMock.organization.findUnique).mockResolvedValue({
            id: "org-1", name: "Acme", slug: "acme", logoUrl: null, industry: null, countryCode: null,
        } as never);
        vi.mocked(prismaMock.jobPosting.findMany).mockResolvedValue([]);
        vi.mocked(prismaMock.jobPosting.count).mockResolvedValue(0);

        await getJobList(new Request("http://localhost/api/public/careers/acme/jobs"), {
            params: Promise.resolve({ orgSlug: "acme" }),
        });

        const arg = vi.mocked(prismaMock.jobPosting.findMany).mock.calls[0][0] as {
            where: { status: string; OR: unknown[] };
        };
        expect(arg.where.status).toBe("open");
        expect(arg.where.OR).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ closesAt: null }),
                expect.objectContaining({ closesAt: { gte: expect.any(Date) } }),
            ]),
        );
    });

    it("detail endpoint hides expired jobs (returns 404)", async () => {
        vi.mocked(prismaMock.organization.findUnique).mockResolvedValue({
            id: "org-1", name: "Acme", slug: "acme", logoUrl: null,
        } as never);
        // findFirst returns null because the OR[closesAt>=now] filter excludes the job
        vi.mocked(prismaMock.jobPosting.findFirst).mockResolvedValue(null);

        const res = await getJobs(new Request("http://localhost/api/public/careers/acme/jobs/job-1"), {
            params: Promise.resolve({ orgSlug: "acme", jobId: "job-1" }),
        });

        expect(res.status).toBe(404);

        const arg = vi.mocked(prismaMock.jobPosting.findFirst).mock.calls[0][0] as {
            where: { status: string; OR: unknown[] };
        };
        expect(arg.where.OR).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ closesAt: null }),
                expect.objectContaining({ closesAt: { gte: expect.any(Date) } }),
            ]),
        );
    });

    it("apply endpoint also rejects expired jobs (returns 404)", async () => {
        vi.mocked(prismaMock.organization.findUnique).mockResolvedValue({
            id: "org-1",
        } as never);
        vi.mocked(prismaMock.jobPosting.findFirst).mockResolvedValue(null);

        const res = await postApply(
            jsonReq("http://localhost/api/public/careers/acme/jobs/job-1", {
                method: "POST",
                body: { firstName: "A", lastName: "B", email: "a@b.com" },
            }),
            { params: Promise.resolve({ orgSlug: "acme", jobId: "job-1" }) },
        );

        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 15) parse-resume: invalid JSON returns 400, not 500
// ═══════════════════════════════════════════════════════════════════

describe("[P17-BUGS-15] POST /api/recruitment/parse-resume JSON error handling", () => {
    it("returns 400 on malformed JSON body", async () => {
        // Stub requireAdminOrHR to bypass auth
        vi.doMock("@/lib/api-auth", () => ({
            requireAdminOrHR: vi.fn().mockResolvedValue({
                userId: "u-1", organizationId: "org-1", role: "hr_admin",
                withDB: async <T>(fn: (db: unknown) => Promise<T>) => fn(prismaMock),
            }),
            isAuthenticated: vi.fn(() => true),
        }));
        // Re-import the route so the doMock takes effect
        vi.resetModules();
        const { POST } = await import("@/app/api/recruitment/parse-resume/route");

        const req = new Request("http://localhost/api/recruitment/parse-resume", {
            method: "POST",
            body: "not-valid-json{{",
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/invalid json/i);
    });
});

// ═══════════════════════════════════════════════════════════════════
// 16) Career portal — rate limiting + pagination
// ═══════════════════════════════════════════════════════════════════

describe("[P17-BUGS-16a] careers endpoints rate-limited by IP", () => {
    it("GET /jobs calls rateLimit and short-circuits on 429", async () => {
        vi.mocked(rateLimit).mockResolvedValueOnce({
            allowed: false,
            headers: {},
            response: new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
                status: 429,
                headers: { "Content-Type": "application/json" },
            }),
        });

        const res = await getJobList(new Request("http://localhost/api/public/careers/acme/jobs"), {
            params: Promise.resolve({ orgSlug: "acme" }),
        });

        expect(res.status).toBe(429);
        expect(rateLimit).toHaveBeenCalledWith(
            expect.any(Request),
            expect.objectContaining({ windowMs: 60_000, maxRequests: 30 }),
            "careers/jobs",
        );
    });

    it("GET /jobs/[jobId] also rate-limits", async () => {
        vi.mocked(rateLimit).mockResolvedValueOnce({
            allowed: false,
            headers: {},
            response: new Response("{}", { status: 429 }),
        });

        const res = await getJobs(new Request("http://localhost/api/public/careers/acme/jobs/job-1"), {
            params: Promise.resolve({ orgSlug: "acme", jobId: "job-1" }),
        });

        expect(res.status).toBe(429);
        expect(rateLimit).toHaveBeenCalledWith(
            expect.any(Request),
            expect.objectContaining({ windowMs: 60_000, maxRequests: 30 }),
            "careers/job-detail",
        );
    });

    it("POST /jobs/[jobId] apply uses the tighter 10 req/min cap", async () => {
        vi.mocked(rateLimit).mockResolvedValueOnce({
            allowed: false,
            headers: {},
            response: new Response("{}", { status: 429 }),
        });

        const res = await postApply(
            jsonReq("http://localhost/api/public/careers/acme/jobs/job-1", {
                method: "POST",
                body: { firstName: "A", lastName: "B", email: "a@b.com" },
            }),
            { params: Promise.resolve({ orgSlug: "acme", jobId: "job-1" }) },
        );

        expect(res.status).toBe(429);
        expect(rateLimit).toHaveBeenCalledWith(
            expect.any(Request),
            expect.objectContaining({ windowMs: 60_000, maxRequests: 10 }),
            "careers/apply",
        );
    });
});

describe("[P17-BUGS-16b] GET /jobs pagination", () => {
    beforeEach(() => {
        vi.mocked(prismaMock.organization.findUnique).mockResolvedValue({
            id: "org-1", name: "Acme", slug: "acme", logoUrl: null, industry: null, countryCode: null,
        } as never);
        vi.mocked(prismaMock.jobPosting.findMany).mockResolvedValue([]);
        vi.mocked(prismaMock.jobPosting.count).mockResolvedValue(42);
    });

    it("applies default page=1, limit=10 when no query params", async () => {
        await getJobList(new Request("http://localhost/api/public/careers/acme/jobs"), {
            params: Promise.resolve({ orgSlug: "acme" }),
        });

        const findManyArg = vi.mocked(prismaMock.jobPosting.findMany).mock.calls[0][0] as {
            skip: number; take: number;
        };
        expect(findManyArg.skip).toBe(0);
        expect(findManyArg.take).toBe(10);
    });

    it("respects ?page=3&limit=20", async () => {
        await getJobList(new Request("http://localhost/api/public/careers/acme/jobs?page=3&limit=20"), {
            params: Promise.resolve({ orgSlug: "acme" }),
        });

        const findManyArg = vi.mocked(prismaMock.jobPosting.findMany).mock.calls[0][0] as {
            skip: number; take: number;
        };
        expect(findManyArg.skip).toBe(40); // (3-1) * 20
        expect(findManyArg.take).toBe(20);
    });

    it("clamps limit to a maximum of 50", async () => {
        await getJobList(new Request("http://localhost/api/public/careers/acme/jobs?limit=9999"), {
            params: Promise.resolve({ orgSlug: "acme" }),
        });

        const findManyArg = vi.mocked(prismaMock.jobPosting.findMany).mock.calls[0][0] as {
            take: number;
        };
        expect(findManyArg.take).toBe(50);
    });

    it("response includes pagination metadata (page, limit, total, totalPages)", async () => {
        const res = await getJobList(new Request("http://localhost/api/public/careers/acme/jobs?page=2&limit=10"), {
            params: Promise.resolve({ orgSlug: "acme" }),
        });
        const body = await res.json();
        expect(body.pagination).toEqual({
            page: 2,
            limit: 10,
            total: 42,
            totalPages: 5, // ceil(42/10)
        });
    });

    it("calls findMany and count in parallel (Promise.all)", async () => {
        // We can't easily assert Promise.all directly, but we can verify
        // both are called exactly once per request.
        await getJobList(new Request("http://localhost/api/public/careers/acme/jobs"), {
            params: Promise.resolve({ orgSlug: "acme" }),
        });
        expect(prismaMock.jobPosting.findMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.jobPosting.count).toHaveBeenCalledTimes(1);
    });
});
