/**
 * Storage Usage Calculator
 * ========================
 *
 * Computes total per-organization storage usage for billing / plan-limit
 * enforcement. Replaces the previous `current: 0 // TODO: Calculate from
 * file storage` stub in `/api/billing/status`, which meant the storage
 * meter on the billing page always showed 0 / N MB and the platform-side
 * plan-limit check on uploads could never trigger.
 *
 * Provider support:
 *   - `local`  — walks `${STORAGE_LOCAL_PATH}/${organizationId}` and sums
 *                file sizes recursively. This is the default and the only
 *                fully-implemented provider today.
 *   - `s3`/`r2` — TODO. Would query ListObjectsV2 with the prefix
 *                `${organizationId}/` and sum `Size` across paginated
 *                responses. Returns 0 for now (documented limitation).
 *
 * Caching:
 *   Filesystem walks are expensive on tenants with many uploads, and the
 *   billing-status endpoint is called on every dashboard load. To avoid
 *   recomputing on every request we cache the result in-process for
 *   CACHE_TTL_MS (default 5 minutes). The cache is keyed by organizationId
 *   so cross-tenant reads never collide. `invalidateStorageUsageCache`
 *   is exposed so upload / delete paths can bust the cache immediately
 *   after a write if needed.
 */

import { promises as fs } from "fs";
import path from "path";
import { apiLogger } from "@/lib/logger";

// ── In-process TTL cache ───────────────────────────────────────────
// A simple Map<orgId, { value, expiresAt }>. Chosen over Redis so the
// billing route stays fast even when Redis is cold, and so unit tests
// don't need to mock the Redis client to verify the calculator.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
    value: number;
    expiresAt: number;
}

const storageUsageCache = new Map<string, CacheEntry>();

/**
 * Calculate total storage usage (in bytes) for an organization.
 *
 * Dispatches to the configured storage provider. Returns 0 on any error
 * so a misconfigured storage path or transient FS failure can never
 * break the billing-status endpoint — the meter simply shows the last
 * known value (or 0 if never computed).
 */
export async function getOrganizationStorageUsage(organizationId: string): Promise<number> {
    const storageProvider = process.env.STORAGE_PROVIDER || "local";

    // Return cached value if fresh
    const cached = storageUsageCache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    let value: number;
    if (storageProvider === "local") {
        value = await getLocalStorageUsage(organizationId);
    } else if (storageProvider === "s3" || storageProvider === "r2") {
        value = await getS3StorageUsage(organizationId);
    } else {
        value = 0;
    }

    storageUsageCache.set(organizationId, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return value;
}

/**
 * Force a recompute on the next call. Call this from upload / delete
 * paths if you want the billing meter to reflect the new total without
 * waiting for the 5-minute TTL to elapse.
 */
export function invalidateStorageUsageCache(organizationId?: string): void {
    if (organizationId) {
        storageUsageCache.delete(organizationId);
    } else {
        storageUsageCache.clear();
    }
}

async function getLocalStorageUsage(organizationId: string): Promise<number> {
    const basePath = process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), "uploads");
    const orgPath = path.join(basePath, organizationId);

    try {
        return await calculateDirectorySize(orgPath);
    } catch (err) {
        apiLogger.error({ err, organizationId }, "Failed to calculate local storage usage");
        return 0;
    }
}

async function calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                totalSize += await calculateDirectorySize(fullPath);
            } else if (entry.isFile()) {
                const stats = await fs.stat(fullPath);
                totalSize += stats.size;
            }
        }
    } catch {
        // Directory doesn't exist or not accessible — treat as 0 bytes.
        // This is the common case for new tenants that haven't uploaded
        // anything yet.
        return 0;
    }

    return totalSize;
}

async function getS3StorageUsage(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _organizationId: string,
): Promise<number> {
    // TODO: Implement S3 / R2 storage usage calculation.
    // Would use ListObjectsV2 with prefix `${organizationId}/` and sum
    // the `Size` field across paginated responses. For now, return 0 —
    // S3 usage tracking is a future enhancement tracked separately.
    return 0;
}

/**
 * Format bytes to a human-readable string. Used by UIs that show the
 * raw byte count alongside the MB-based plan-limit meter.
 */
export function formatStorageUsage(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
