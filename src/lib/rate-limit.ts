/**
 * Rate Limiter for API Routes — Redis-backed
 *
 * Enterprise SaaS rate limiting that works across
 * multiple containers/instances using Redis INCR + EXPIRE.
 *
 * In production, Redis failures deny limited routes so brute-force controls do not fail open.
 */

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

    const headers: Record<string, string> = {
        "X-RateLimit-Limit": config.maxRequests.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.resetIn.toString(),
    };

    if (!result.allowed) {
        return {
            allowed: false,
            headers,
            response: new Response(
                JSON.stringify({
                    error: "Too many requests",
                    message:
                        "Rate limit exceeded. Please try again later.",
                    retryAfter: result.resetIn,
                }),
                {
                    status: 429,
                    headers: {
                        "Content-Type": "application/json",
                        "Retry-After": result.resetIn.toString(),
                        ...headers,
                    },
                }
            ),
        };
    }

    return { allowed: true, headers };
}
