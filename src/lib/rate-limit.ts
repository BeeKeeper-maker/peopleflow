/**
 * Rate Limiter for API Routes — Redis-backed
 *
 * Enterprise SaaS rate limiting that works across
 * multiple containers/instances using Redis INCR + EXPIRE.
 *
 * In production, Redis failures deny limited routes so brute-force controls do not fail open.
 *
 * Response Headers (P9-RATELIMIT-HEADERS):
 * Every rate-limited route is expected to forward the returned
 * `headers` map onto its success responses so that API clients can
 * read `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`
 * and back off BEFORE hitting the 429 wall. Routes can do this with:
 *
 *   const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, auth.userId);
 *   if (!rl.allowed) return rl.response!;
 *   const res = NextResponse.json(data);
 *   for (const [k, v] of Object.entries(rl.headers)) res.headers.set(k, v);
 *   return res;
 */

import { NextResponse } from "next/server";
import { checkRedisRateLimit } from "@/lib/redis";

// ============================================
// Configurations
// ============================================

interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
}

function envPositiveInt(name: string, fallback: number): number {
    const value = process.env[name];
    if (!value) return fallback;

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Default configurations for different route types
export const RATE_LIMIT_CONFIGS = {
    // Strict limit for auth routes (prevent brute force). Override only in controlled QA/E2E environments.
    auth: {
        windowMs: envPositiveInt("RATE_LIMIT_AUTH_WINDOW_MS", 15 * 60 * 1000), // 15 minutes
        maxRequests: envPositiveInt("RATE_LIMIT_AUTH_MAX", 10), // 10 attempts
    },
    // Standard limit for authenticated API routes
    api: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100, // 100 requests
    },
    // Loose limit for read operations
    read: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 300, // 300 requests
    },
    // Generous limit for authenticated write operations (creates/updates).
    // Per-user-keyed via the `rateLimit(request, config, userId)` call site,
    // so this is per-user-per-minute, not per-IP-per-minute.
    write: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60, // 60 requests/min — generous for legitimate UI use,
                          // blocks scripted bulk creates/updates
    },
    // Strict limit for very heavy operations (payroll runs, bulk imports).
    // Prevents concurrent/heavy resource usage from starving other tenants.
    heavy: {
        windowMs: 10 * 60 * 1000, // 10 minutes
        maxRequests: 3, // 3 runs per 10 minutes (e.g. payroll re-processing)
    },
    // Very strict for sensitive operations
    sensitive: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 5, // 5 requests
    },
    // External API rate limit (per API key)
    external: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 1000, // 1000 requests
    },
} as const;

// ============================================
// IP Extraction
// ============================================

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
        return realIP;
    }
    return "127.0.0.1";
}

// ============================================
// Core Rate Limit Check
// ============================================

/**
 * Create rate limit key from IP and optional route
 */
export function createRateLimitKey(ip: string, route?: string): string {
    return route ? `${ip}:${route}` : ip;
}

/**
 * Check rate limit for a given key — Redis-backed
 * Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
    key: string,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    const result = await checkRedisRateLimit(
        key,
        config.maxRequests,
        windowSeconds
    );

    return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetIn: result.allowed ? windowSeconds : result.retryAfter,
    };
}

// ============================================
// Middleware-style Rate Limiter
// ============================================

/**
 * Middleware-style rate limiter
 * Usage in API routes:
 *   const rl = await rateLimit(request, RATE_LIMIT_CONFIGS.auth, "auth/login");
 *   if (!rl.allowed) return rl.response;
 */
export async function rateLimit(
    request: Request,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.api,
    route?: string
): Promise<{
    allowed: boolean;
    headers: Record<string, string>;
    response?: Response;
}> {
    const ip = getClientIP(request);
    const key = createRateLimitKey(ip, route);
    const result = await checkRateLimit(key, config);

    // IETF RateLimit header draft: `X-RateLimit-Reset` is the UTC epoch
    // second at which the current window resets, not a relative duration.
    // `result.resetIn` is seconds-from-now until reset (windowSeconds when
    // allowed, retryAfter TTL when blocked).
    const resetEpochSeconds = Math.ceil(
        (Date.now() + result.resetIn * 1000) / 1000
    );

    const headers: Record<string, string> = {
        "X-RateLimit-Limit": config.maxRequests.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": resetEpochSeconds.toString(),
    };

    if (!result.allowed) {
        return {
            allowed: false,
            headers,
            response: rateLimitExceededResponse(result.resetIn, headers),
        };
    }

    return { allowed: true, headers };
}

// ============================================
// Standard 429 Response Builder
// ============================================

/**
 * Build a standard 429 "Too Many Requests" response with rate-limit
 * headers attached. Callers pass the `retryAfter` (seconds until the
 * window resets) and the rate-limit `headers` map returned by `rateLimit`.
 *
 * Used by `rateLimit` internally, and exported so custom rate-limit
 * code paths (e.g. middleware-level limits) can reuse the same body
 * shape and header set.
 */
export function rateLimitExceededResponse(
    retryAfter: number,
    headers: Record<string, string>
): NextResponse {
    return NextResponse.json(
        {
            error: "Rate limit exceeded",
            message: `Too many requests. Please retry after ${retryAfter} seconds.`,
            retryAfter,
        },
        {
            status: 429,
            headers: {
                "Retry-After": String(retryAfter),
                ...headers,
            },
        }
    );
}

// ============================================
// Header-Forwarding Helper
// ============================================

/**
 * Apply rate-limit headers (X-RateLimit-Limit / -Remaining / -Reset)
 * onto an existing NextResponse. Returns the same response instance
 * so callers can write a one-liner:
 *
 *   return applyRateLimitHeaders(NextResponse.json(data), rl.headers);
 *
 * For 429 responses use `rateLimitExceededResponse` instead — it
 * sets `Retry-After` as well.
 */
export function applyRateLimitHeaders(
    response: NextResponse,
    headers: Record<string, string>
): NextResponse {
    for (const [key, value] of Object.entries(headers)) {
        response.headers.set(key, value);
    }
    return response;
}
