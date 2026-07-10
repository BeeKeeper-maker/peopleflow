/**
 * Platform API: SaaS Analytics & Metrics
 *
 * GET /api/platform/analytics
 *
 * Returns the Mission Control dashboard metrics:
 * - MRR, ARR, Revenue growth
 * - Active tenants, churn rate
 * - Trial conversion rate
 * - Plan distribution
 * - Top tenants by employee count
 * - Recent activity (sign-ups, cancellations)
 *
 * Platform admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    verifyPlatformRequest,
    isPlatformVerified,
} from "@/lib/platform-token";
import { apiLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // ── 1. Revenue Metrics ──────────────────────────────

        // Get all active subscriptions with plans
        const activeSubscriptions = await prisma.subscription.findMany({
            where: {
                status: { in: ["active", "past_due", "trialing"] },
            },
            include: {
                plan: {
                    select: {
                        priceMonthly: true,
                        priceYearly: true,
                        slug: true,
                        name: true,
                    },
                },
            },
        });

        // Calculate MRR (Monthly Recurring Revenue)
        // For yearly subs: divide by 12. For trialing: count at $0.
        let mrr = 0;
        for (const sub of activeSubscriptions) {
            if (sub.status === "trialing") continue; // Trials don't count toward revenue
            if (sub.billingCycle === "yearly") {
                mrr += Math.round(sub.plan.priceYearly / 12);
            } else {
                mrr += sub.plan.priceMonthly;
            }
        }

        const arr = mrr * 12;

        // Revenue from last 30 days (from paid invoices)
        const recentRevenue = await prisma.invoice.aggregate({
            where: {
                status: "paid",
                paidAt: { gte: thirtyDaysAgo },
            },
            _sum: { amount: true },
            _count: true,
        });

        // Previous 30 days revenue (for growth %)
        const previousRevenue = await prisma.invoice.aggregate({
            where: {
                status: "paid",
                paidAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
            },
            _sum: { amount: true },
        });

        const revenueGrowth =
            previousRevenue._sum.amount && previousRevenue._sum.amount > 0
                ? Math.round(
                      (((recentRevenue._sum.amount || 0) -
                          previousRevenue._sum.amount) /
                          previousRevenue._sum.amount) *
                          100
                  )
                : 0;

        // ── 2. Tenant Metrics ──────────────────────────────

        const [
            totalTenants,
            activeTenants,
            suspendedTenants,
            trialTenants,
        ] = await prisma.$transaction([
            prisma.organization.count(),
            prisma.organization.count({
                where: { status: "active" },
            }),
            prisma.organization.count({
                where: { status: "suspended" },
            }),
            prisma.subscription.count({
                where: { status: "trialing" },
            }),
        ]);

        // New sign-ups in last 30 days
        const newTenantsThisMonth = await prisma.organization.count({
            where: { createdAt: { gte: thirtyDaysAgo } },
        });

        // ── 3. Churn Analysis ──────────────────────────────

        // Canceled in last 30 days
        const canceledThisMonth = await prisma.subscription.count({
            where: {
                status: "canceled",
                updatedAt: { gte: thirtyDaysAgo },
            },
        });

        // Active at start of month
        const activeStartOfMonth = await prisma.subscription.count({
            where: {
                createdAt: { lt: thirtyDaysAgo },
                status: { in: ["active", "past_due"] },
            },
        });

        const churnRate =
            activeStartOfMonth > 0
                ? Math.round(
                      (canceledThisMonth / activeStartOfMonth) * 100 * 10
                  ) / 10
                : 0;

        // ── 4. Trial Conversion ──────────────────────────────

        // Trials that started 30-60 days ago (had time to convert)
        const trialsStarted = await prisma.subscription.count({
            where: {
                trialStart: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
            },
        });

        const trialsConverted = await prisma.subscription.count({
            where: {
                trialStart: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
                status: { in: ["active", "past_due"] },
            },
        });

        const trialConversionRate =
            trialsStarted > 0
                ? Math.round((trialsConverted / trialsStarted) * 100)
                : 0;

        // ── 5. Plan Distribution ──────────────────────────────

        const planDistribution = await prisma.subscription.groupBy({
            by: ["planId"],
            where: {
                status: { in: ["active", "trialing", "past_due"] },
            },
            _count: true,
        });

        // Enrich with plan names
        const plans = await prisma.plan.findMany({
            select: { id: true, name: true, slug: true, priceMonthly: true },
        });

        const planMap = new Map(plans.map((p) => [p.id, p]));
        const planBreakdown = planDistribution.map((pd) => ({
            plan: planMap.get(pd.planId) || { name: "Unknown", slug: "unknown" },
            count: pd._count,
        }));

        // ── 6. Top Tenants by Size ──────────────────────────

        const topTenants = await prisma.organization.findMany({
            where: { status: "active" },
            include: {
                _count: { select: { employees: true } },
                subscription: {
                    include: {
                        plan: { select: { name: true, slug: true } },
                    },
                },
            },
            orderBy: { employees: { _count: "desc" } },
            take: 10,
        });

        // ── 7. Recent Activity ──────────────────────────────

        const recentActivity = await prisma.platformAuditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 15,
            include: {
                platformAdmin: {
                    select: { name: true, email: true },
                },
            },
        });

        // ── 8. Failed Payments ──────────────────────────────

        const failedPayments = await prisma.invoice.count({
            where: {
                status: "failed",
                createdAt: { gte: thirtyDaysAgo },
            },
        });

        const pastDueTenants = await prisma.subscription.count({
            where: { status: "past_due" },
        });

        // ── 9. Historical MRR Trend (last 6 months) ──────────

        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const monthlyInvoices = await prisma.invoice.findMany({
            where: {
                status: "paid",
                paidAt: { gte: sixMonthsAgo },
            },
            select: { amount: true, paidAt: true },
        });

        // Group by month
        const monthMap = new Map<string, number>();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            monthMap.set(key, 0);
        }

        for (const inv of monthlyInvoices) {
            if (!inv.paidAt) continue;
            const d = new Date(inv.paidAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (monthMap.has(key)) {
                monthMap.set(key, (monthMap.get(key) || 0) + (inv.amount || 0));
            }
        }

        const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const revenueTrend = Array.from(monthMap.entries()).map(([key, revenue]) => {
            const [year, month] = key.split("-");
            const monthIdx = parseInt(month, 10) - 1;
            return {
                month: `${MONTH_NAMES[monthIdx]} ${year.slice(2)}`,
                mrr: Math.round(revenue / 100), // Convert poisha to taka
            };
        });

        // ── Build Response ──────────────────────────────

        return NextResponse.json({
            revenue: {
                mrr,
                arr,
                mrrFormatted: formatCurrency(mrr),
                arrFormatted: formatCurrency(arr),
                recentRevenue: recentRevenue._sum.amount || 0,
                recentRevenueFormatted: formatCurrency(
                    recentRevenue._sum.amount || 0
                ),
                invoicesPaid: recentRevenue._count,
                revenueGrowthPercent: revenueGrowth,
                revenueTrend, // Historical 6-month MRR trend
            },
            tenants: {
                total: totalTenants,
                active: activeTenants,
                suspended: suspendedTenants,
                trialing: trialTenants,
                newThisMonth: newTenantsThisMonth,
                revenuePerTenant:
                    activeTenants > 0
                        ? formatCurrency(Math.round(mrr / activeTenants))
                        : "৳0",
            },
            health: {
                churnRate,
                trialConversionRate,
                failedPayments,
                pastDueTenants,
            },
            planBreakdown,
            topTenants: topTenants.map((t) => ({
                id: t.id,
                name: t.name,
                employees: t._count.employees,
                plan: t.subscription?.plan?.name || "No plan",
            })),
            recentActivity: recentActivity.map((a) => ({
                id: a.id,
                action: a.action,
                targetType: a.targetType,
                targetId: a.targetId,
                adminName: a.platformAdmin.name,
                createdAt: a.createdAt,
            })),
            generatedAt: now.toISOString(),
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_ANALYTICS] Error:");
        return NextResponse.json(
            { error: "Failed to generate analytics" },
            { status: 500 }
        );
    }
}

// ── Helpers ──

function formatCurrency(amountInPoisha: number): string {
    // Convert from poisha to taka
    const taka = amountInPoisha / 100;
    return `৳${taka.toLocaleString("en-BD")}`;
}
