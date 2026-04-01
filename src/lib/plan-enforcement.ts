/**
 * Plan Enforcement Middleware — 3-Layer Defense
 *
 * Layer 1: API-level resource limit checks (this file)
 * Layer 2: Feature flag gating (feature-gate.ts)
 * Layer 3: Periodic background audit (CRON — future)
 *
 * Checks are Redis-cached to avoid per-request DB queries.
 */

import { prisma } from "@/lib/prisma";
import {
    getCachedSubscription,
    setCachedSubscription,
    getCachedResourceCount,
    setCachedResourceCount,
    invalidateResourceCount,
    type CachedSubscription,
} from "@/lib/redis";

// ============================================
// Types
// ============================================

export type ResourceType =
    | "employee"
    | "admin"
    | "branch"
    | "device"
    | "storage";

export interface PlanCheckResult {
    allowed: boolean;
    current: number;
    limit: number;
    message?: string;
    upgradeRequired?: boolean;
}

// ============================================
// Subscription Resolver (with Redis cache)
// ============================================

/**
 * Get the subscription + plan details for an organization.
 * Reads from Redis first (5-min TTL), falls back to DB.
 */
export async function getOrgSubscription(
    organizationId: string
): Promise<CachedSubscription | null> {
    // 1. Try cache
    const cached = await getCachedSubscription(organizationId);
    if (cached) return cached;

    // 2. Fetch from DB
    const sub = await prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true },
    });

    if (!sub) return null;

    // 3. Build cacheable object
    const cacheable: CachedSubscription = {
        id: sub.id,
        status: sub.status,
        planId: sub.planId,
        planSlug: sub.plan.slug,
        maxEmployees: sub.plan.maxEmployees,
        maxAdmins: sub.plan.maxAdmins,
        maxBranches: sub.plan.maxBranches,
        maxDevices: sub.plan.maxDevices,
        maxStorageMB: sub.plan.maxStorageMB,
        features: sub.plan.features as Record<string, boolean>,
        maxEmployeesOverride: sub.maxEmployeesOverride,
        maxStorageOverride: sub.maxStorageOverride,
    };

    // 4. Cache it
    await setCachedSubscription(organizationId, cacheable);

    return cacheable;
}

// ============================================
// Resource Count Resolver (with Redis cache)
// ============================================

/**
 * Get the current count of a resource type for an organization.
 * Reads from Redis first (5-min TTL), falls back to DB.
 */
async function getResourceCount(
    organizationId: string,
    resource: ResourceType
): Promise<number> {
    // 1. Try cache
    const cached = await getCachedResourceCount(organizationId, resource);
    if (cached !== null) return cached;

    // 2. Count from DB
    let count: number;

    switch (resource) {
        case "employee":
            count = await prisma.employee.count({
                where: {
                    organizationId,
                    employmentStatus: { in: ["active", "probation"] },
                    deletedAt: null,
                },
            });
            break;

        case "admin":
            count = await prisma.user.count({
                where: {
                    organizationId,
                    role: { in: ["admin", "hr_admin"] },
                    isActive: true,
                },
            });
            break;

        case "branch":
            count = await prisma.branch.count({
                where: { organizationId, isActive: true },
            });
            break;

        case "device":
            count = await prisma.biometricDevice.count({
                where: { organizationId, isActive: true },
            });
            break;

        case "storage":
            // Storage tracking would come from UsageRecord
            const storageRecord = await prisma.usageRecord.findFirst({
                where: { organizationId, metric: "storage_mb" },
                orderBy: { recordedAt: "desc" },
            });
            count = storageRecord ? Math.ceil(storageRecord.value) : 0;
            break;

        default:
            count = 0;
    }

    // 3. Cache it
    await setCachedResourceCount(organizationId, resource, count);

    return count;
}

// ============================================
// Core Enforcement Function
// ============================================

/**
 * Check if creating a new resource is allowed under the current plan.
 *
 * Usage in API routes:
 *   const check = await enforcePlanLimit(orgId, "employee");
 *   if (!check.allowed) {
 *     return NextResponse.json(
 *       { error: check.message, upgradeRequired: true },
 *       { status: 402 }
 *     );
 *   }
 */
export async function enforcePlanLimit(
    organizationId: string,
    resource: ResourceType,
    action: "create" | "check" = "create"
): Promise<PlanCheckResult> {
    // 1. Get subscription
    const sub = await getOrgSubscription(organizationId);

    // No subscription = no access
    if (!sub) {
        return {
            allowed: false,
            current: 0,
            limit: 0,
            message:
                "No active subscription found. Please subscribe to a plan to continue.",
            upgradeRequired: true,
        };
    }

    // Subscription not in good standing
    if (!["active", "trialing"].includes(sub.status)) {
        return {
            allowed: false,
            current: 0,
            limit: 0,
            message:
                sub.status === "past_due"
                    ? "Your payment is overdue. Please update your billing information."
                    : "Your subscription is not active. Please contact support.",
            upgradeRequired: true,
        };
    }

    // 2. Determine limit (respect enterprise overrides)
    const limits: Record<ResourceType, number> = {
        employee: sub.maxEmployeesOverride ?? sub.maxEmployees,
        admin: sub.maxAdmins,
        branch: sub.maxBranches,
        device: sub.maxDevices,
        storage: sub.maxStorageOverride ?? sub.maxStorageMB,
    };

    const limit = limits[resource];

    // -1 means unlimited
    if (limit === -1) {
        return { allowed: true, current: 0, limit: -1 };
    }

    // 3. Get current count
    const current = await getResourceCount(organizationId, resource);

    // 4. Enforce
    if (action === "create" && current >= limit) {
        return {
            allowed: false,
            current,
            limit,
            message: `You've reached your plan limit of ${limit} ${resource}${limit !== 1 ? "s" : ""}. Upgrade your plan to add more.`,
            upgradeRequired: true,
        };
    }

    return { allowed: true, current, limit };
}

/**
 * Called after a resource is created — invalidate the count cache
 * so the next check fetches fresh data.
 */
export async function onResourceCreated(
    organizationId: string,
    resource: ResourceType
): Promise<void> {
    await invalidateResourceCount(organizationId, resource);
}

/**
 * Called after a resource is deleted — invalidate the count cache.
 */
export async function onResourceDeleted(
    organizationId: string,
    resource: ResourceType
): Promise<void> {
    await invalidateResourceCount(organizationId, resource);
}

/**
 * Get usage summary for an organization (for dashboard display)
 */
export async function getUsageSummary(organizationId: string): Promise<{
    plan: string;
    status: string;
    limits: Record<ResourceType, { current: number; limit: number }>;
}> {
    const sub = await getOrgSubscription(organizationId);

    if (!sub) {
        return {
            plan: "none",
            status: "no_subscription",
            limits: {
                employee: { current: 0, limit: 0 },
                admin: { current: 0, limit: 0 },
                branch: { current: 0, limit: 0 },
                device: { current: 0, limit: 0 },
                storage: { current: 0, limit: 0 },
            },
        };
    }

    const [employees, admins, branches, devices, storage] = await Promise.all([
        getResourceCount(organizationId, "employee"),
        getResourceCount(organizationId, "admin"),
        getResourceCount(organizationId, "branch"),
        getResourceCount(organizationId, "device"),
        getResourceCount(organizationId, "storage"),
    ]);

    return {
        plan: sub.planSlug,
        status: sub.status,
        limits: {
            employee: {
                current: employees,
                limit: sub.maxEmployeesOverride ?? sub.maxEmployees,
            },
            admin: { current: admins, limit: sub.maxAdmins },
            branch: { current: branches, limit: sub.maxBranches },
            device: { current: devices, limit: sub.maxDevices },
            storage: {
                current: storage,
                limit: sub.maxStorageOverride ?? sub.maxStorageMB,
            },
        },
    };
}
