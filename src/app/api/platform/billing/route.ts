/**
 * Platform API: Billing & Invoices
 *
 * GET /api/platform/billing
 *
 * Returns paginated invoices across all tenants with revenue metrics.
 * Platform admin only.
 *
 * Query params:
 *  - page, limit       : pagination
 *  - status            : invoice status filter (pending|paid|failed|refunded|void|all)
 *  - search            : tenant name or invoice number search
 *  - from, to          : date range on createdAt
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
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
        const status = url.searchParams.get("status"); // pending|paid|failed|refunded|void|all
        const search = url.searchParams.get("search")?.trim();
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");

        // ── Build where clause ──
        const where: {
            status?: string;
            createdAt?: Record<string, unknown>;
            OR?: Array<Record<string, unknown>>;
        } = {};

        if (status && status !== "all") {
            where.status = status;
        }

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(to);
        }

        if (search) {
            where.OR = [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { subscription: { organization: { name: { contains: search, mode: "insensitive" } } } },
            ];
        }

        // ── Fetch invoices with pagination ──
        const [invoices, total] = await prisma.$transaction([
            prisma.invoice.findMany({
                where,
                include: {
                    subscription: {
                        select: {
                            id: true,
                            status: true,
                            billingCycle: true,
                            organization: {
                                select: { id: true, name: true, slug: true },
                            },
                            plan: {
                                select: { id: true, name: true, slug: true, priceMonthly: true, priceYearly: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.invoice.count({ where }),
        ]);

        // ── Aggregate metrics (across ALL invoices, ignoring filters) ──
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const [
            allPaid,
            allPending,
            allFailed,
            allRefunded,
            paidThisMonth,
            paidLastMonth,
            failedPayments,
            pastDueTenantsCount,
        ] = await Promise.all([
            prisma.invoice.aggregate({
                _sum: { amount: true },
                _count: true,
                where: { status: "paid" },
            }),
            prisma.invoice.aggregate({
                _sum: { amount: true },
                _count: true,
                where: { status: "pending" },
            }),
            prisma.invoice.aggregate({
                _sum: { amount: true },
                _count: true,
                where: { status: "failed" },
            }),
            prisma.invoice.aggregate({
                _sum: { amount: true },
                _count: true,
                where: { status: "refunded" },
            }),
            prisma.invoice.aggregate({
                _sum: { amount: true },
                where: {
                    status: "paid",
                    paidAt: { gte: thirtyDaysAgo },
                },
            }),
            prisma.invoice.aggregate({
                _sum: { amount: true },
                where: {
                    status: "paid",
                    paidAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
                },
            }),
            prisma.invoice.count({
                where: { status: "failed" },
            }),
            prisma.subscription.count({
                where: { status: "past_due" },
            }),
        ]);

        // Convert smallest-currency-unit (paisa) back to Taka for display
        const toBDT = (amount: number | null | undefined) => (amount ?? 0) / 100;

        // Revenue growth percent (this month vs last month)
        const thisMonthBDT = toBDT(paidThisMonth._sum.amount);
        const lastMonthBDT = toBDT(paidLastMonth._sum.amount);
        const revenueGrowthPercent = lastMonthBDT > 0
            ? Math.round(((thisMonthBDT - lastMonthBDT) / lastMonthBDT) * 100)
            : thisMonthBDT > 0 ? 100 : 0;

        return NextResponse.json({
            invoices: invoices.map(inv => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                status: inv.status,
                amountBDT: toBDT(inv.amount),
                amountRaw: inv.amount,
                currency: inv.currency,
                description: inv.description,
                paidAt: inv.paidAt,
                failedAt: inv.failedAt,
                failureReason: inv.failureReason,
                paymentMethod: inv.paymentMethod,
                periodStart: inv.periodStart,
                periodEnd: inv.periodEnd,
                dueDate: inv.dueDate,
                createdAt: inv.createdAt,
                subscription: {
                    id: inv.subscription.id,
                    status: inv.subscription.status,
                    billingCycle: inv.subscription.billingCycle,
                    organization: inv.subscription.organization,
                    plan: inv.subscription.plan,
                },
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            metrics: {
                totalRevenueBDT: toBDT(allPaid._sum.amount),
                totalInvoicesPaid: allPaid._count,
                pendingRevenueBDT: toBDT(allPending._sum.amount),
                pendingInvoices: allPending._count,
                failedRevenueBDT: toBDT(allFailed._sum.amount),
                failedInvoices: allFailed._count,
                refundedRevenueBDT: toBDT(allRefunded._sum.amount),
                refundedInvoices: allRefunded._count,
                revenueThisMonthBDT: thisMonthBDT,
                revenueLastMonthBDT: lastMonthBDT,
                revenueGrowthPercent,
                failedPayments,
                pastDueTenants: pastDueTenantsCount,
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_BILLING] Error:");
        return NextResponse.json(
            { error: "Failed to fetch billing data" },
            { status: 500 }
        );
    }
}
