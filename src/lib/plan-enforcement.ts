/**
 * Plan Enforcement Middleware — 3-Layer Defense
 *
 * Layer 1: API-level resource limit checks (this file)
 * Layer 2: Feature flag gating (feature-gate.ts)
 * Layer 3: Periodic background audit (CRON — future)
 *
 * Checks are Redis-cached to avoid per-request DB queries.
 */

import { withTenant, type TxClient } from "@/lib/prisma";
import { toPlainSettings } from "@/lib/settings-json";
import { mergePlanFeaturesWithModules } from "@/lib/module-entitlements";
import fs from "fs/promises";
import path from "path";
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

function normalizeSubscriptionStatus<T extends CachedSubscription>(sub: T): T {
  const now = Date.now();
  const trialEnd = sub.trialEnd ? new Date(sub.trialEnd).getTime() : null;
  const currentPeriodEnd = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).getTime()
    : null;

  if (sub.status === "trialing" && trialEnd !== null && trialEnd < now) {
    return { ...sub, status: "expired" };
  }

  if (
    sub.status === "active" &&
    currentPeriodEnd !== null &&
    currentPeriodEnd < now
  ) {
    return { ...sub, status: "expired" };
  }

  return sub;
}

async function calculateTenantStorageMB(
  organizationId: string,
): Promise<number> {
  const tenantRoot = path.join(process.cwd(), "uploads", organizationId);

  async function walk(dir: string): Promise<number> {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
      throw error;
    }

    let total = 0;
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await walk(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        total += stat.size;
      }
    }
    return total;
  }

  const bytes = await walk(tenantRoot);
  return bytes / (1024 * 1024);
}

// ============================================
// Subscription Resolver (with Redis cache)
// ============================================

/**
 * Get the subscription + plan details for an organization.
 * Reads from Redis first (5-min TTL), falls back to DB.
 */
export async function getOrgSubscription(
  organizationId: string,
): Promise<CachedSubscription | null> {
  // 1. Try cache
  const cached = await getCachedSubscription(organizationId);
  if (cached) return normalizeSubscriptionStatus(cached);

  // 2. Fetch from DB within the tenant RLS context. This keeps plan checks
  // working when production uses the non-superuser app role with forced RLS.
  const sub = await withTenant(organizationId, (db) =>
    db.subscription.findUnique({
      where: { organizationId },
      include: {
        plan: true,
        organization: { select: { settings: true } },
      },
    }),
  );

  if (!sub) return null;

  const settings = toPlainSettings(sub.organization.settings);
  const saasOverrides = settings.saasOverrides as
    | {
        limits?: Partial<Record<"maxAdmins" | "maxBranches" | "maxDevices", number | null>>;
        features?: Record<string, boolean | null>;
      }
    | undefined;
  const featureOverrides = saasOverrides?.features ?? {};
  const cleanFeatureOverrides = Object.fromEntries(
    Object.entries(featureOverrides).filter(([, value]) => typeof value === "boolean"),
  ) as Record<string, boolean>;

  // 3. Build cacheable object. Platform-admin custom deals are merged here so
  // every API limit check and feature gate uses the same source of truth.
  const cacheable: CachedSubscription = {
    id: sub.id,
    status: sub.status,
    planId: sub.planId,
    planSlug: sub.plan.slug,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEnd: sub.trialEnd,
    maxEmployees: sub.plan.maxEmployees,
    maxAdmins: saasOverrides?.limits?.maxAdmins ?? sub.plan.maxAdmins,
    maxBranches: saasOverrides?.limits?.maxBranches ?? sub.plan.maxBranches,
    maxDevices: saasOverrides?.limits?.maxDevices ?? sub.plan.maxDevices,
    maxStorageMB: sub.plan.maxStorageMB,
    features: mergePlanFeaturesWithModules({
      ...(sub.plan.features as Record<string, boolean>),
      ...cleanFeatureOverrides,
    }),
    maxEmployeesOverride: sub.maxEmployeesOverride,
    maxStorageOverride: sub.maxStorageOverride,
  };

  // 4. Cache it
  await setCachedSubscription(organizationId, cacheable);

  return normalizeSubscriptionStatus(cacheable);
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
  resource: ResourceType,
): Promise<number> {
  // 1. Try cache
  const cached = await getCachedResourceCount(organizationId, resource);
  if (cached !== null) return cached;

  // 2. Count from DB inside the tenant RLS context. Without this, forced RLS
  // can make legitimate tenant rows invisible or reject inserts.
  let count: number;

  const countWithTenant = <T>(fn: (db: TxClient) => Promise<T>) =>
    withTenant(organizationId, fn);

  switch (resource) {
    case "employee":
      count = await countWithTenant((db) =>
        db.employee.count({
          where: {
            organizationId,
            employmentStatus: { in: ["active", "probation"] },
            deletedAt: null,
          },
        }),
      );
      break;

    case "admin":
      count = await countWithTenant((db) =>
        db.user.count({
          where: {
            organizationId,
            role: { in: ["admin", "hr_admin"] },
            isActive: true,
          },
        }),
      );
      break;

    case "branch":
      count = await countWithTenant((db) =>
        db.branch.count({
          where: { organizationId, isActive: true },
        }),
      );
      break;

    case "device":
      count = await countWithTenant((db) =>
        db.biometricDevice.count({
          where: { organizationId, isActive: true },
        }),
      );
      break;

    case "storage": {
      const liveStorageMB = await calculateTenantStorageMB(organizationId);
      count = Math.ceil(liveStorageMB);

      await countWithTenant((db) =>
        db.usageRecord.create({
          data: {
            organizationId,
            metric: "storage_mb",
            value: liveStorageMB,
          },
        }),
      );
      break;
    }

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
  action: "create" | "check" = "create",
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
  resource: ResourceType,
): Promise<void> {
  await invalidateResourceCount(organizationId, resource);
}

/**
 * Called after a resource is deleted — invalidate the count cache.
 */
export async function onResourceDeleted(
  organizationId: string,
  resource: ResourceType,
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
