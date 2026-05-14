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
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";
import { getOrgSubscription } from "@/lib/plan-enforcement";

export async function GET() {
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
        );
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return NextResponse.json(
                { error: "No organization found" },
                { status: 400 }
            );
        }

        const orgId = user.organizationId;

        // Get subscription + plan + recent invoices
        const subscription = await prisma.subscription.findUnique({
            where: { organizationId: orgId },
            include: {
                plan: true,
                invoices: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                },
            },
        });

        if (!subscription) {
            return NextResponse.json({
                hasSubscription: false,
                message: "No active subscription",
            });
        }

        // Get current resource counts
        const [employeeCount, userCount, branchCount] =
            await prisma.$transaction([
                prisma.employee.count({
                    where: { organizationId: orgId },
                }),
                prisma.user.count({
                    where: {
                        organizationId: orgId,
                        role: { in: ["admin", "hr_admin"] },
                        isActive: true,
                    },
                }),
                prisma.branch.count({
                    where: { organizationId: orgId },
                }),
            ]);

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
                current: 0, // TODO: Calculate from file storage
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
