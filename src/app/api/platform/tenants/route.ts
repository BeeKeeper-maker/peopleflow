/**
 * Platform API: List All Tenants
 *
 * GET /api/platform/tenants
 *
 * Returns paginated list of all organizations with subscription/plan data.
 * Supports search, status filtering, and plan filtering.
 * Platform admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    requirePlatformAuth,
    isPlatformAuthenticated,
} from "@/lib/platform-auth";
import { apiLogger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

    try {
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
        const search = url.searchParams.get("search")?.trim();
        const status = url.searchParams.get("status"); // active, suspended, deactivated
        const planSlug = url.searchParams.get("plan"); // starter, growth, enterprise
        const sortBy = url.searchParams.get("sort") || "createdAt";
        const sortOrder = url.searchParams.get("order") === "asc" ? "asc" : "desc";

        // Build where clause
        const where: Record<string, unknown> = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
            ];
        }

        if (status) {
            where.status = status;
        }

        if (planSlug) {
            where.subscription = {
                plan: { slug: planSlug },
            };
        }

        // Execute query
        const [organizations, total] = await prisma.$transaction([
            prisma.organization.findMany({
                where,
                include: {
                    subscription: {
                        include: {
                            plan: {
                                select: {
                                    name: true,
                                    slug: true,
                                    priceMonthly: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            employees: true,
                            users: true,
                            branches: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.organization.count({ where }),
        ]);

        // Transform for response
        const tenants = organizations.map((org) => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            status: org.status,
            suspendedAt: org.suspendedAt,
            suspendedReason: org.suspendedReason,
            onboardedAt: org.onboardedAt,
            trialEndsAt: org.trialEndsAt,
            createdAt: org.createdAt,
            // Subscription info
            subscription: org.subscription
                ? {
                      id: org.subscription.id,
                      status: org.subscription.status,
                      billingCycle: org.subscription.billingCycle,
                      currentPeriodEnd: org.subscription.currentPeriodEnd,
                      cancelAtPeriodEnd: org.subscription.cancelAtPeriodEnd,
                      plan: org.subscription.plan,
                  }
                : null,
            // Resource counts
            counts: {
                employees: org._count.employees,
                users: org._count.users,
                branches: org._count.branches,
            },
        }));

        return NextResponse.json({
            tenants,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_TENANTS_LIST] Error:");
        return NextResponse.json(
            { error: "Failed to fetch tenants" },
            { status: 500 }
        );
    }
}
