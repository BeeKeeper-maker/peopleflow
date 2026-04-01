/**
 * Feature Gate — Module Access Control
 *
 * Checks whether a specific feature/module is enabled
 * for the organization's current plan.
 *
 * Works with the `Plan.features` JSONB field:
 *   { "payroll": true, "recruitment": false, ... }
 */

import { getOrgSubscription } from "@/lib/plan-enforcement";

// ============================================
// Feature Definitions
// ============================================

/**
 * Maps feature keys to their API route prefixes.
 * If a route starts with any of these prefixes AND the feature is disabled,
 * the request is blocked with a 403 + upgrade prompt.
 */
export const FEATURE_ROUTE_MAP: Record<string, string[]> = {
    payroll: ["/api/payroll"],
    recruitment: ["/api/recruitment"],
    performance: ["/api/performance"],
    expenses: ["/api/expenses"],
    biometric: ["/api/biometric-devices"],
    apiAccess: ["/api/v1"],
    customDocuments: ["/api/documents"],
    advancedReports: ["/api/reports/advanced"],
};

/**
 * Features that are always available (not gated by plan)
 */
const ALWAYS_ENABLED_ROUTES = [
    "/api/auth",
    "/api/health",
    "/api/webhooks",
    "/api/billing",
    "/api/platform",
    "/api/employees",
    "/api/departments",
    "/api/designations",
    "/api/branches",
    "/api/leaves",
    "/api/attendance",
    "/api/notifications",
    "/api/announcements",
    "/api/search",
    "/api/settings",
    "/api/shifts",
    "/api/holidays",
    "/api/audit-logs",
    "/api/dashboard",
    "/api/upload",
    "/api/uploads",
    "/api/approval-workflows",
    "/api/ess",
];

// ============================================
// Core Feature Check
// ============================================

export interface FeatureCheckResult {
    allowed: boolean;
    feature?: string;
    message?: string;
    upgradeRequired?: boolean;
    requiredPlan?: string;
}

/**
 * Check if a specific feature is enabled for an organization.
 *
 * Usage:
 *   const check = await isFeatureEnabled(orgId, "recruitment");
 *   if (!check.allowed) return NextResponse.json(check, { status: 403 });
 */
export async function isFeatureEnabled(
    organizationId: string,
    feature: string
): Promise<FeatureCheckResult> {
    const sub = await getOrgSubscription(organizationId);

    if (!sub) {
        return {
            allowed: false,
            feature,
            message: "No active subscription. Please subscribe to access this feature.",
            upgradeRequired: true,
        };
    }

    if (!["active", "trialing"].includes(sub.status)) {
        return {
            allowed: false,
            feature,
            message: "Your subscription is not active.",
            upgradeRequired: true,
        };
    }

    const features = sub.features || {};
    const isEnabled = features[feature] !== false; // Default to enabled if not specified

    if (!isEnabled) {
        return {
            allowed: false,
            feature,
            message: `The "${feature}" module is not included in your current plan. Upgrade to unlock it.`,
            upgradeRequired: true,
        };
    }

    return { allowed: true };
}

/**
 * Check if a route path is allowed based on organization's plan features.
 * Returns allowed=true for routes not in the feature gate map.
 */
export async function checkRouteFeatureAccess(
    organizationId: string,
    routePath: string
): Promise<FeatureCheckResult> {
    // Always-enabled routes bypass feature gating entirely
    if (ALWAYS_ENABLED_ROUTES.some((r) => routePath.startsWith(r))) {
        return { allowed: true };
    }

    // Check each feature's routes
    for (const [feature, routes] of Object.entries(FEATURE_ROUTE_MAP)) {
        if (routes.some((r) => routePath.startsWith(r))) {
            return isFeatureEnabled(organizationId, feature);
        }
    }

    // Routes not in the map are always allowed
    return { allowed: true };
}

/**
 * Get all feature flags for an organization's plan.
 * Used by the frontend to show/hide module navigation.
 */
export async function getOrgFeatures(
    organizationId: string
): Promise<Record<string, boolean>> {
    const sub = await getOrgSubscription(organizationId);

    if (!sub || !["active", "trialing"].includes(sub.status)) {
        // No subscription: return all features as disabled
        return {
            payroll: false,
            recruitment: false,
            performance: false,
            expenses: false,
            biometric: false,
            apiAccess: false,
            customDocuments: false,
            advancedReports: false,
        };
    }

    // Default all features to true if not explicitly set to false
    const defaults: Record<string, boolean> = {
        payroll: true,
        recruitment: true,
        performance: true,
        expenses: true,
        biometric: true,
        apiAccess: false, // Disabled by default — enterprise only
        customDocuments: true,
        advancedReports: false, // Disabled by default — growth+ only
    };

    const planFeatures = (sub.features || {}) as Record<string, boolean>;

    return { ...defaults, ...planFeatures };
}
