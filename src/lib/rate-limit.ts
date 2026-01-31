/**
 * Rate Limiter for API Routes
 * Protects against brute force attacks and API abuse
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
}

// In-memory store (for production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default configurations for different route types
export const RATE_LIMIT_CONFIGS = {
    // Strict limit for auth routes (prevent brute force)
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 10,          // 10 attempts
    },
    // Standard limit for authenticated API routes
    api: {
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 100,         // 100 requests
    },
    // Loose limit for read operations
    read: {
        windowMs: 60 * 1000,      // 1 minute
        maxRequests: 300,         // 300 requests
    },
    // Very strict for sensitive operations
    sensitive: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 5,           // 5 requests
    },
} as const;

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

/**
 * Check rate limit for a given key
 * Returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
        cleanupExpiredEntries();
    }

    if (!entry || now > entry.resetTime) {
        // First request or window expired
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + config.windowMs,
        });
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetIn: config.windowMs,
        };
    }

    if (entry.count >= config.maxRequests) {
        // Rate limit exceeded
        return {
            allowed: false,
            remaining: 0,
            resetIn: entry.resetTime - now,
        };
    }

    // Increment counter
    entry.count++;
    rateLimitStore.set(key, entry);

    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetIn: entry.resetTime - now,
    };
}

/**
 * Create rate limit key from IP and optional route
 */
export function createRateLimitKey(ip: string, route?: string): string {
    return route ? `${ip}:${route}` : ip;
}

/**
 * Middleware-style rate limiter
 */
export function rateLimit(
    request: Request,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.api,
    route?: string
): {
    allowed: boolean;
    headers: Record<string, string>;
    response?: Response;
} {
    const ip = getClientIP(request);
    const key = createRateLimitKey(ip, route);
    const result = checkRateLimit(key, config);

    const headers: Record<string, string> = {
        "X-RateLimit-Limit": config.maxRequests.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": Math.ceil(result.resetIn / 1000).toString(),
    };

    if (!result.allowed) {
        return {
            allowed: false,
            headers,
            response: new Response(
                JSON.stringify({
                    error: "Too many requests",
                    message: "Rate limit exceeded. Please try again later.",
                    retryAfter: Math.ceil(result.resetIn / 1000),
                }),
                {
                    status: 429,
                    headers: {
                        "Content-Type": "application/json",
                        "Retry-After": Math.ceil(result.resetIn / 1000).toString(),
                        ...headers,
                    },
                }
            ),
        };
    }

    return { allowed: true, headers };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Reset rate limit for a specific key (for testing)
 */
export function resetRateLimit(key: string): void {
    rateLimitStore.delete(key);
}

/**
 * Get current rate limit status (for monitoring)
 */
export function getRateLimitStatus(): { totalEntries: number; keys: string[] } {
    return {
        totalEntries: rateLimitStore.size,
        keys: Array.from(rateLimitStore.keys()),
    };
}
