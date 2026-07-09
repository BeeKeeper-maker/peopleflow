/**
 * ═══════════════════════════════════════════════════════════════════
 * UNIT TESTS: Rate Limiting (P10-TESTS)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Coverage for @/lib/rate-limit — the Redis-backed limiter added in
 * P9-RATELIMIT-HEADERS. Verifies:
 *
 *   a) RATE_LIMIT_CONFIGS shape (read / write / heavy / auth)
 *   b) applyRateLimitHeaders — adds X-RateLimit-* to a NextResponse
 *   c) rateLimitExceededResponse — 429 + Retry-After + body shape
 *   d) rateLimit — allowed/blocked branches + header values
 *   e) checkRateLimit — passes Redis result through, resetIn math
 *   f) getClientIP / createRateLimitKey helpers
 *
 * Determinism: `@/lib/redis` is mocked at the module level so no real
 * Redis client is created; `checkRedisRateLimit` is a vi.fn whose return
 * value each test controls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ── Mock @/lib/redis before importing the module under test ────────
// The factory only references vi.fn() primitives, so vitest can safely
// hoist it above the import statements below.
vi.mock("@/lib/redis", () => ({
    checkRedisRateLimit: vi.fn(),
    getRedis: vi.fn(),
    isRedisDisabledForRuntime: vi.fn(() => false),
}));

import {
    RATE_LIMIT_CONFIGS,
    applyRateLimitHeaders,
    rateLimitExceededResponse,
    rateLimit,
    checkRateLimit,
    getClientIP,
    createRateLimitKey,
} from "@/lib/rate-limit";
import { checkRedisRateLimit } from "@/lib/redis";

// ═══════════════════════════════════════════════════════════════════
// a) RATE_LIMIT_CONFIGS shape
// ═══════════════════════════════════════════════════════════════════

describe("RATE_LIMIT_CONFIGS", () => {
    it("exposes a read config with a 1-minute window and 300 max requests", () => {
        expect(RATE_LIMIT_CONFIGS.read.windowMs).toBe(60 * 1000);
        expect(RATE_LIMIT_CONFIGS.read.maxRequests).toBe(300);
    });

    it("exposes a write config with a 1-minute window and 60 max requests", () => {
        expect(RATE_LIMIT_CONFIGS.write.windowMs).toBe(60 * 1000);
        expect(RATE_LIMIT_CONFIGS.write.maxRequests).toBe(60);
    });

    it("exposes a heavy config with a 10-minute window and 3 max requests", () => {
        expect(RATE_LIMIT_CONFIGS.heavy.windowMs).toBe(10 * 60 * 1000);
        expect(RATE_LIMIT_CONFIGS.heavy.maxRequests).toBe(3);
    });

    it("exposes an auth config with a 15-minute window and 10 max requests", () => {
        expect(RATE_LIMIT_CONFIGS.auth.windowMs).toBe(15 * 60 * 1000);
        expect(RATE_LIMIT_CONFIGS.auth.maxRequests).toBe(10);
    });
});

// ═══════════════════════════════════════════════════════════════════
// b) applyRateLimitHeaders
// ═══════════════════════════════════════════════════════════════════

describe("applyRateLimitHeaders", () => {
    it("sets X-RateLimit-Limit / -Remaining / -Reset on a NextResponse", () => {
        const res = new NextResponse(null);
        applyRateLimitHeaders(res, {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "99",
            "X-RateLimit-Reset": "1700000000",
        });

        expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
        expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
        expect(res.headers.get("X-RateLimit-Reset")).toBe("1700000000");
    });

    it("returns the SAME NextResponse instance so it can be used inline", () => {
        const res = NextResponse.json({ ok: true });
        const returned = applyRateLimitHeaders(res, {
            "X-RateLimit-Limit": "1",
        });
        expect(returned).toBe(res);
    });

    it("preserves pre-existing non-rate-limit headers on the response", () => {
        const res = NextResponse.json(
            { ok: true },
            { headers: { "X-Custom-Header": "abc" } },
        );
        applyRateLimitHeaders(res, { "X-RateLimit-Limit": "5" });

        expect(res.headers.get("X-Custom-Header")).toBe("abc");
        expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
    });
});

// ═══════════════════════════════════════════════════════════════════
// c) rateLimitExceededResponse
// ═══════════════════════════════════════════════════════════════════

describe("rateLimitExceededResponse", () => {
    const baseHeaders = {
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "1700000030",
    };

    it("returns a 429 status code", () => {
        const res = rateLimitExceededResponse(30, baseHeaders);
        expect(res.status).toBe(429);
    });

    it("sets Retry-After to the supplied seconds value", () => {
        const res = rateLimitExceededResponse(42, baseHeaders);
        expect(res.headers.get("Retry-After")).toBe("42");
    });

    it("forwards X-RateLimit-* headers from the headers map onto the 429", () => {
        const res = rateLimitExceededResponse(5, baseHeaders);
        expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
        expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(res.headers.get("X-RateLimit-Reset")).toBe("1700000030");
    });

    it("body contains error, message, and retryAfter fields", async () => {
        const res = rateLimitExceededResponse(15, baseHeaders);
        const body = await res.json();
        expect(body.error).toBe("Rate limit exceeded");
        expect(body.message).toContain("15");
        expect(body.retryAfter).toBe(15);
    });
});

// ═══════════════════════════════════════════════════════════════════
// d) rateLimit
// ═══════════════════════════════════════════════════════════════════

describe("rateLimit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns allowed:true with headers and no response when under the limit", async () => {
        vi.mocked(checkRedisRateLimit).mockResolvedValue({
            allowed: true,
            remaining: 299,
            retryAfter: 0,
        });

        const req = new Request("http://localhost/api/test");
        const result = await rateLimit(req, RATE_LIMIT_CONFIGS.read);

        expect(result.allowed).toBe(true);
        expect(result.response).toBeUndefined();
        expect(result.headers).toEqual(
            expect.objectContaining({
                "X-RateLimit-Limit": "300",
                "X-RateLimit-Remaining": "299",
                "X-RateLimit-Reset": expect.any(String),
            }),
        );
    });

    it("returns allowed:false with a 429 response when over the limit", async () => {
        vi.mocked(checkRedisRateLimit).mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfter: 30,
        });

        const req = new Request("http://localhost/api/test");
        const result = await rateLimit(req, RATE_LIMIT_CONFIGS.read);

        expect(result.allowed).toBe(false);
        expect(result.response).toBeDefined();
        expect(result.response!.status).toBe(429);
    });

    it("X-RateLimit-Limit reflects the config maxRequests and remaining reflects Redis result", async () => {
        vi.mocked(checkRedisRateLimit).mockResolvedValue({
            allowed: true,
            remaining: 59,
            retryAfter: 0,
        });

        const req = new Request("http://localhost/api/test");
        const result = await rateLimit(req, RATE_LIMIT_CONFIGS.write);

        expect(result.headers["X-RateLimit-Limit"]).toBe("60");
        expect(result.headers["X-RateLimit-Remaining"]).toBe("59");
    });

    it("X-RateLimit-Reset is a future UTC epoch second when allowed", async () => {
        vi.mocked(checkRedisRateLimit).mockResolvedValue({
            allowed: true,
            remaining: 299,
            retryAfter: 0,
        });

        const before = Math.ceil(Date.now() / 1000);
        const req = new Request("http://localhost/api/test");
        const result = await rateLimit(req, RATE_LIMIT_CONFIGS.read);
        const after = Math.ceil(Date.now() / 1000) + 60;

        const reset = Number(result.headers["X-RateLimit-Reset"]);
        // read window is 60s; reset should be roughly now + 60s
        expect(reset).toBeGreaterThanOrEqual(before + 59);
        expect(reset).toBeLessThanOrEqual(after + 2);
    });

    it("429 response includes Retry-After matching the blocked resetIn seconds", async () => {
        vi.mocked(checkRedisRateLimit).mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfter: 30,
        });

        const req = new Request("http://localhost/api/test");
        const result = await rateLimit(req, RATE_LIMIT_CONFIGS.read);

        expect(result.response!.headers.get("Retry-After")).toBe("30");
    });

    it("passes the IP-derived key + maxRequests + windowSeconds to checkRedisRateLimit", async () => {
        vi.mocked(checkRedisRateLimit).mockResolvedValue({
            allowed: true,
            remaining: 0,
            retryAfter: 0,
        });

        const req = new Request("http://localhost/api/test", {
            headers: { "x-forwarded-for": "1.2.3.4" },
        });
        await rateLimit(req, RATE_LIMIT_CONFIGS.read, "route-x");

        expect(checkRedisRateLimit).toHaveBeenCalledWith(
            "1.2.3.4:route-x",
            300, // maxRequests
            60,  // windowSeconds = 60_000 / 1000
        );
    });
});

// ═══════════════════════════════════════════════════════════════════
// e) checkRateLimit
// ═══════════════════════════════════════════════════════════════════

describe("checkRateLimit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns remaining from Redis check and resetIn equal to windowSeconds when allowed", async () => {
        vi.mocked(checkRedisRateLimit).mockResolvedValue({
            allowed: true,
            remaining: 99,
            retryAfter: 0,
        });

        const result = await checkRateLimit("1.2.3.4", RATE_LIMIT_CONFIGS.api);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(99);
        // api window is 60s → resetIn is 60 (windowSeconds when allowed)
        expect(result.resetIn).toBe(60);
    });

    it("returns resetIn equal to Redis retryAfter when blocked", async () => {
        vi.mocked(checkRedisRateLimit).mockResolvedValue({
            allowed: false,
            remaining: 0,
            retryAfter: 45,
        });

        const result = await checkRateLimit("1.2.3.4", RATE_LIMIT_CONFIGS.api);
        expect(result.allowed).toBe(false);
        expect(result.resetIn).toBe(45);
    });
});

// ═══════════════════════════════════════════════════════════════════
// f) getClientIP / createRateLimitKey
// ═══════════════════════════════════════════════════════════════════

describe("getClientIP", () => {
    it("extracts the first IP from a comma-separated x-forwarded-for header", () => {
        const req = new Request("http://localhost/", {
            headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
        });
        expect(getClientIP(req)).toBe("1.2.3.4");
    });

    it("falls back to x-real-ip when x-forwarded-for is absent", () => {
        const req = new Request("http://localhost/", {
            headers: { "x-real-ip": "9.9.9.9" },
        });
        expect(getClientIP(req)).toBe("9.9.9.9");
    });

    it("returns 127.0.0.1 when no IP headers are present", () => {
        const req = new Request("http://localhost/");
        expect(getClientIP(req)).toBe("127.0.0.1");
    });
});

describe("createRateLimitKey", () => {
    it("combines IP and route with a colon when a route is supplied", () => {
        expect(createRateLimitKey("1.2.3.4", "auth/login")).toBe("1.2.3.4:auth/login");
    });

    it("returns the IP alone when no route is supplied", () => {
        expect(createRateLimitKey("1.2.3.4")).toBe("1.2.3.4");
    });
});
