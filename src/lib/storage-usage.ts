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
 *                file sizes recursively. This is the default.
 *   - `s3`/`r2` — uses AWS SDK `ListObjectsV2Command` with the prefix
 *                `${organizationId}/` and sums `Size` across paginated
 *                responses. The SDK is lazy-required (same pattern as
 *                `src/lib/storage.ts`) so the module loads cleanly even
 *                when `@aws-sdk/client-s3` isn't installed.
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

async function getS3StorageUsage(organizationId: string): Promise<number> {
    // Mirror the env-var resolution in src/lib/storage.ts:getStorageService.
    // S3_* is the canonical name (also wired in docker-compose.yml and
    // .env.example); STORAGE_S3_* is the legacy alias kept for backward
    // compatibility with existing deployments that haven't migrated yet.
    const bucket = process.env.S3_BUCKET || process.env.STORAGE_S3_BUCKET;
    const endpoint = process.env.S3_ENDPOINT || process.env.STORAGE_S3_ENDPOINT;
    const region = process.env.S3_REGION || process.env.STORAGE_S3_REGION || "auto";
    const accessKeyId = process.env.S3_ACCESS_KEY || process.env.STORAGE_S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY || process.env.STORAGE_S3_SECRET_KEY;

    // If S3 isn't configured at all, return 0 instead of throwing. This
    // keeps the billing-status endpoint working for self-hosted tenants
    // that haven't configured S3 yet — the meter just shows 0.
    if (!bucket || !accessKeyId || !secretAccessKey) {
        return 0;
    }

    try {
        // Lazy-require so the module loads cleanly even when the SDK isn't
        // installed (same pattern as src/lib/storage.ts). Also keeps the
        // AWS SDK out of the bundle for local-only tenants.
        const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
        const s3Client = new S3Client({
            region,
            endpoint: endpoint || undefined,
            credentials: { accessKeyId, secretAccessKey },
            // forcePathStyle is required for S3-alternative endpoints
            // (Cloudflare R2, MinIO, Wasabi, etc.) that don't support
            // virtual-host-style addressing.
            forcePathStyle: !!endpoint,
        });

        let totalSize = 0;
        let continuationToken: string | undefined;
        const prefix = `${organizationId}/`;

        // Paginate through every object under the org prefix. ListObjectsV2
        // returns up to 1,000 keys per request; IsTruncated + NextContinuationToken
        // signal more pages. MaxKeys is the upper bound, not a guarantee.
        do {
            const response = await s3Client.send(
                new ListObjectsV2Command({
                    Bucket: bucket,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                    MaxKeys: 1000,
                }),
            );

            if (response.Contents) {
                for (const obj of response.Contents) {
                    totalSize += obj.Size || 0;
                }
            }

            continuationToken = response.IsTruncated
                ? response.NextContinuationToken
                : undefined;
        } while (continuationToken);

        return totalSize;
    } catch (err) {
        apiLogger.error(
            { err, organizationId },
            "S3 storage usage calculation failed",
        );
        // Return 0 on any error so a transient S3 outage doesn't break the
        // billing-status endpoint. The 5-min in-process cache will keep
        // serving the last successful value until the next TTL refresh.
        return 0;
    }
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
