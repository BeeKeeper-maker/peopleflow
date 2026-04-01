/**
 * Redis Client — Enterprise SaaS Infrastructure
 *
 * Centralized Redis client for:
 * - Rate limiting (shared across containers)
 * - Organization status caching (kill switch)
 * - Subscription/Plan caching (plan enforcement)
 * - Resource count caching (limit enforcement)
 * - Impersonation session validation
 */

import Redis from "ioredis";

let redis: Redis | null = null;

/**
 * Get or create the Redis singleton
 */
export function getRedis(): Redis {
    if (!redis) {
        const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 5) {
                    console.error("[REDIS] Max retries reached. Giving up.");
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 200, 2000);
                return delay;
            },
            lazyConnect: true,
            enableReadyCheck: true,
            connectTimeout: 10000,
        });

        redis.on("error", (err) => {
            console.error("[REDIS] Connection error:", err.message);
        });

        redis.on("connect", () => {
            console.log("[REDIS] Connected successfully");
        });

        redis.on("ready", () => {
            console.log("[REDIS] Ready to accept commands");
        });
    }
    return redis;
}

// ============================================
// Cache Helpers
// ============================================

/**
 * Get a cached value (parsed from JSON)
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
    try {
        const data = await getRedis().get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error("[REDIS] cacheGet error:", error);
        return null;
    }
}

/**
 * Set a cached value with TTL (seconds)
 */
export async function cacheSet(
    key: string,
    value: unknown,
    ttlSeconds: number
): Promise<void> {
    try {
        await getRedis().setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
        console.error("[REDIS] cacheSet error:", error);
    }
}

/**
 * Delete a specific cache key
 */
export async function cacheDel(key: string): Promise<void> {
    try {
        await getRedis().del(key);
    } catch (error) {
        console.error("[REDIS] cacheDel error:", error);
    }
}

/**
 * Invalidate all keys matching a pattern
 * WARNING: KEYS command is O(N) — use sparingly, never in hot paths
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
    try {
        const keys = await getRedis().keys(pattern);
        if (keys.length > 0) {
            await getRedis().del(...keys);
        }
    } catch (error) {
        console.error("[REDIS] cacheInvalidate error:", error);
    }
}

// ============================================
// Rate Limiting (Redis-backed)
// ============================================

/**
 * Check rate limit using Redis INCR + EXPIRE (sliding window)
 * Returns { allowed, remaining, retryAfter }
 */
export async function checkRedisRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
): Promise<{
    allowed: boolean;
    remaining: number;
    retryAfter: number;
}> {
    try {
        const redisKey = `rl:${key}`;
        const current = await getRedis().incr(redisKey);

        // Set expiry on first request in window
        if (current === 1) {
            await getRedis().expire(redisKey, windowSeconds);
        }

        const ttl = await getRedis().ttl(redisKey);
        const remaining = Math.max(0, maxRequests - current);

        if (current > maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                retryAfter: ttl > 0 ? ttl : windowSeconds,
            };
        }

        return {
            allowed: true,
            remaining,
            retryAfter: 0,
        };
    } catch (error) {
        // On Redis failure, ALLOW the request (fail-open)
        // Better to allow some extra requests than block all users
        console.error("[REDIS] Rate limit check failed, allowing request:", error);
        return { allowed: true, remaining: maxRequests, retryAfter: 0 };
    }
}

// ============================================
// Organization Status Cache (Kill Switch)
// ============================================

const ORG_STATUS_TTL = 60; // 1 minute

export interface CachedOrgStatus {
    status: string; // "active" | "suspended" | "deactivated"
    suspendedReason?: string | null;
}

/**
 * Get organization status (cached in Redis, 1-min TTL)
 */
export async function getCachedOrgStatus(
    organizationId: string
): Promise<CachedOrgStatus | null> {
    return cacheGet<CachedOrgStatus>(`org:status:${organizationId}`);
}

/**
 * Set organization status cache
 */
export async function setCachedOrgStatus(
    organizationId: string,
    status: CachedOrgStatus
): Promise<void> {
    await cacheSet(`org:status:${organizationId}`, status, ORG_STATUS_TTL);
}

/**
 * Invalidate org status cache (called after suspend/activate)
 */
export async function invalidateOrgStatus(
    organizationId: string
): Promise<void> {
    await cacheDel(`org:status:${organizationId}`);
}

// ============================================
// Subscription Cache (Plan Enforcement)
// ============================================

const SUB_CACHE_TTL = 300; // 5 minutes

export interface CachedSubscription {
    id: string;
    status: string;
    planId: string;
    planSlug: string;
    maxEmployees: number;
    maxAdmins: number;
    maxBranches: number;
    maxDevices: number;
    maxStorageMB: number;
    features: Record<string, boolean>;
    // Overrides
    maxEmployeesOverride?: number | null;
    maxStorageOverride?: number | null;
}

/**
 * Get cached subscription for an organization
 */
export async function getCachedSubscription(
    organizationId: string
): Promise<CachedSubscription | null> {
    return cacheGet<CachedSubscription>(`sub:${organizationId}`);
}

/**
 * Set cached subscription
 */
export async function setCachedSubscription(
    organizationId: string,
    sub: CachedSubscription
): Promise<void> {
    await cacheSet(`sub:${organizationId}`, sub, SUB_CACHE_TTL);
}

/**
 * Invalidate subscription cache (called after plan change, webhook)
 */
export async function invalidateSubscription(
    organizationId: string
): Promise<void> {
    await cacheDel(`sub:${organizationId}`);
}

// ============================================
// Resource Count Cache (Limit Enforcement)
// ============================================

const COUNT_CACHE_TTL = 300; // 5 minutes

/**
 * Get cached resource count for an organization
 */
export async function getCachedResourceCount(
    organizationId: string,
    resource: string
): Promise<number | null> {
    return cacheGet<number>(`count:${organizationId}:${resource}`);
}

/**
 * Set cached resource count
 */
export async function setCachedResourceCount(
    organizationId: string,
    resource: string,
    count: number
): Promise<void> {
    await cacheSet(`count:${organizationId}:${resource}`, count, COUNT_CACHE_TTL);
}

/**
 * Invalidate a resource count (called when resource is created/deleted)
 */
export async function invalidateResourceCount(
    organizationId: string,
    resource: string
): Promise<void> {
    await cacheDel(`count:${organizationId}:${resource}`);
}

/**
 * Invalidate ALL caches for an organization
 */
export async function invalidateAllOrgCaches(
    organizationId: string
): Promise<void> {
    await cacheInvalidate(`*:${organizationId}*`);
}
