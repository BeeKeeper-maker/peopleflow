/**
 * Platform API: Plan Management (CRUD)
 *
 * GET /api/platform/plans — List all plans
 * POST /api/platform/plans — Create a new plan
 * PATCH /api/platform/plans — Update an existing plan
 *
 * Platform admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    requirePlatformAuth,
    isPlatformAuthenticated,
    logPlatformAction,
} from "@/lib/platform-auth";
import { apiLogger } from "@/lib/logger";

/**
 * GET: List all plans with subscriber counts
 */
export async function GET(request: NextRequest) {
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

    try {
        const plans = await prisma.plan.findMany({
            orderBy: { sortOrder: "asc" },
            include: {
                _count: {
                    select: { subscriptions: true },
                },
            },
        });

        return NextResponse.json({
            plans: plans.map((plan) => ({
                ...plan,
                subscriberCount: plan._count.subscriptions,
                _count: undefined,
            })),
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_PLANS_LIST] Error:");
        return NextResponse.json(
            { error: "Failed to fetch plans" },
            { status: 500 }
        );
    }
}

/**
 * POST: Create a new plan
 */
export async function POST(request: NextRequest) {
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

    try {
        const body = await request.json();
        const {
            name,
            slug,
            description,
            priceMonthly,
            priceYearly,
            currency = "BDT",
            maxEmployees,
            maxAdmins = 3,
            maxBranches = 1,
            maxDevices = 0,
            maxStorageMB = 500,
            features = {},
            stripePriceIdMonthly,
            stripePriceIdYearly,
            sortOrder = 0,
        } = body;

        // Validation
        if (!name || !slug || priceMonthly === undefined || priceYearly === undefined || maxEmployees === undefined) {
            return NextResponse.json(
                {
                    error: "name, slug, priceMonthly, priceYearly, and maxEmployees are required",
                },
                { status: 400 }
            );
        }

        // Check slug uniqueness
        const existing = await prisma.plan.findUnique({
            where: { slug },
        });

        if (existing) {
            return NextResponse.json(
                { error: `Plan with slug '${slug}' already exists` },
                { status: 409 }
            );
        }

        const plan = await prisma.plan.create({
            data: {
                name,
                slug,
                description,
                priceMonthly,
                priceYearly,
                currency,
                maxEmployees,
                maxAdmins,
                maxBranches,
                maxDevices,
                maxStorageMB,
                features,
                stripePriceIdMonthly,
                stripePriceIdYearly,
                sortOrder,
            },
        });

        await logPlatformAction({
            adminId: auth.adminId,
            action: "plan.create",
            targetType: "plan",
            targetId: plan.id,
            metadata: { name, slug, priceMonthly, priceYearly },
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        return NextResponse.json({ success: true, plan }, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_PLANS_CREATE] Error:");
        return NextResponse.json(
            { error: "Failed to create plan" },
            { status: 500 }
        );
    }
}

/**
 * PATCH: Update an existing plan
 */
export async function PATCH(request: NextRequest) {
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Plan id is required" },
                { status: 400 }
            );
        }

        const existing = await prisma.plan.findUnique({
            where: { id },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "Plan not found" },
                { status: 404 }
            );
        }

        // Whitelist updatable fields
        const allowedFields = [
            "name",
            "description",
            "priceMonthly",
            "priceYearly",
            "maxEmployees",
            "maxAdmins",
            "maxBranches",
            "maxDevices",
            "maxStorageMB",
            "features",
            "stripePriceIdMonthly",
            "stripePriceIdYearly",
            "isActive",
            "sortOrder",
        ];

        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }

        const plan = await prisma.plan.update({
            where: { id },
            data: updateData,
        });

        await logPlatformAction({
            adminId: auth.adminId,
            action: "plan.update",
            targetType: "plan",
            targetId: id,
            metadata: {
                updatedFields: Object.keys(updateData),
                planName: existing.name,
            },
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        return NextResponse.json({ success: true, plan });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_PLANS_UPDATE] Error:");
        return NextResponse.json(
            { error: "Failed to update plan" },
            { status: 500 }
        );
    }
}
