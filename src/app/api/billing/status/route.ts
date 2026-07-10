/**
 * Tenant Billing API: Subscription Status & Usage
 *
 * GET /api/billing/status — Get current org's subscription status, plan limits, and usage
 *
 * Returns everything the tenant's billing settings page needs:
 * - Current plan details
 * - Subscription status
 * - Resource usage vs limits
 * - Billing history (recent invoices)
 *
 * SECURITY: All tenant-scoped reads go through `requireAuth()` + `auth.withDB()`
 * so they are RLS-scoped to the caller's organization and protected by
 * sessionVersion / isActive / org-status checks enforced in requireAuth().
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { getOrgSubscription } from "@/lib/plan-enforcement";
import { getOrganizationStorageUsage } from "@/lib/storage-usage";

export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const orgId = auth.organizationId;

        // Get subscription + plan + recent invoices (RLS-scoped)
        const subscription = await auth.withDB((db) =>
            db.subscription.findUnique({
                where: { organizationId: orgId },
                include: {
                    plan: true,
                    invoices: {
                        orderBy: { createdAt: "desc" },
                        take: 10,
                    },
                },
            }),
        );

        if (!subscription) {
            return NextResponse.json({
                hasSubscription: false,
                message: "No active subscription",
            });
        }

        // Get current resource counts (RLS-scoped)
        const [employeeCount, userCount, branchCount] = await auth.withDB((db) =>
            Promise.all([
                db.employee.count({
                    where: { organizationId: orgId },
                }),
                db.user.count({
                    where: {
                        organizationId: orgId,
                        role: { in: ["admin", "hr_admin"] },
                        isActive: true,
                    },
                }),
                db.branch.count({
                    where: { organizationId: orgId },
                }),
            ]),
        );

        // Storage usage is computed from the file system (local) or S3 API
        // (TODO) — not a DB count. The result is cached in-process for
        // CACHE_TTL_MS (5 min) inside getOrganizationStorageUsage so a
        // dashboard refresh doesn't trigger a full directory walk on every
        // request. Returns bytes; convert to MB to match the plan-limit unit.
        const storageUsedBytes = await getOrganizationStorageUsage(orgId);
        const storageUsedMB = Math.ceil(storageUsedBytes / (1024 * 1024));

        const plan = subscription.plan;
        const effectiveSubscription = await getOrgSubscription(orgId);
        const effectiveLimits = {
            maxEmployees: effectiveSubscription?.maxEmployeesOverride ?? effectiveSubscription?.maxEmployees ?? subscription.maxEmployeesOverride ?? plan.maxEmployees,
            maxAdmins: effectiveSubscription?.maxAdmins ?? plan.maxAdmins,
            maxBranches: effectiveSubscription?.maxBranches ?? plan.maxBranches,
            maxStorageMB: effectiveSubscription?.maxStorageOverride ?? effectiveSubscription?.maxStorageMB ?? subscription.maxStorageOverride ?? plan.maxStorageMB,
        };

        // Build usage data from effective plan + platform-owner custom deal overrides.
        const usage = {
            employees: {
                current: employeeCount,
                limit: effectiveLimits.maxEmployees,
                unlimited: effectiveLimits.maxEmployees === -1,
            },
            admins: {
                current: userCount,
                limit: effectiveLimits.maxAdmins,
                unlimited: effectiveLimits.maxAdmins === -1,
            },
            branches: {
                current: branchCount,
                limit: effectiveLimits.maxBranches,
                unlimited: effectiveLimits.maxBranches === -1,
            },
            storage: {
                current: storageUsedMB,
                limit: effectiveLimits.maxStorageMB,
                unlimited: effectiveLimits.maxStorageMB === -1,
            },
        };

        // Trial info
        const isTrialing = subscription.status === "trialing";
        const trialDaysLeft = isTrialing && subscription.trialEnd
            ? Math.max(
                  0,
                  Math.ceil(
                      (subscription.trialEnd.getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                  )
              )
            : 0;

        return NextResponse.json({
            hasSubscription: true,
            subscription: {
                id: subscription.id,
                status: subscription.status,
                billingCycle: subscription.billingCycle,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                isTrialing,
                trialDaysLeft,
                trialEnd: subscription.trialEnd,
            },
            plan: {
                id: plan.id,
                name: plan.name,
                slug: plan.slug,
                priceMonthly: plan.priceMonthly,
                priceYearly: plan.priceYearly,
                currency: plan.currency,
                features: effectiveSubscription?.features || plan.features,
            },
            usage,
            invoices: subscription.invoices.map((inv) => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                status: inv.status,
                amount: inv.amount,
                currency: inv.currency,
                periodStart: inv.periodStart,
                periodEnd: inv.periodEnd,
                paidAt: inv.paidAt,
                dueDate: inv.dueDate,
            })),
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[BILLING_STATUS] Error:");
        return NextResponse.json(
            { error: "Failed to fetch billing status" },
            { status: 500 }
        );
    }
}
