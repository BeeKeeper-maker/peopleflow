/**
 * Platform API: Subscription Management
 *
 * PATCH /api/platform/tenants/[id]/subscription
 *
 * Allows platform admins to:
 * - Change a tenant's plan (upgrade/downgrade)
 * - Override resource limits (enterprise custom deals)
 * - Extend trial period
 * - Force-cancel a subscription
 * - Apply credit to an account
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
import { invalidateSubscription } from "@/lib/redis";
import { apiLogger } from "@/lib/logger";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

    const { id: orgId } = await params;

    try {
        const body = await request.json();
        const { action, ...data } = body;

        if (!action) {
            return NextResponse.json(
                { error: "action is required" },
                { status: 400 }
            );
        }

        // Get current subscription
        const subscription = await prisma.subscription.findUnique({
            where: { organizationId: orgId },
            include: { plan: true },
        });

        if (!subscription) {
            return NextResponse.json(
                { error: "No subscription found for this tenant" },
                { status: 404 }
            );
        }

        let result;

        switch (action) {
            case "change_plan": {
                const { planSlug } = data;
                if (!planSlug) {
                    return NextResponse.json(
                        { error: "planSlug is required" },
                        { status: 400 }
                    );
                }

                const newPlan = await prisma.plan.findUnique({
                    where: { slug: planSlug },
                });

                if (!newPlan || !newPlan.isActive) {
                    return NextResponse.json(
                        { error: "Plan not found or inactive" },
                        { status: 400 }
                    );
                }

                result = await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { planId: newPlan.id },
                    include: { plan: true },
                });

                await logPlatformAction({
                    adminId: auth.adminId,
                    action: "subscription.plan_change",
                    targetType: "subscription",
                    targetId: subscription.id,
                    metadata: {
                        organizationId: orgId,
                        oldPlan: subscription.plan.slug,
                        newPlan: planSlug,
                        reason: data.reason || "Admin-initiated plan change",
                    },
                    ipAddress:
                        request.headers.get("x-forwarded-for") || undefined,
                    userAgent:
                        request.headers.get("user-agent") || undefined,
                });

                break;
            }

            case "override_limits": {
                const updateData: Record<string, unknown> = {};

                if (data.maxEmployeesOverride !== undefined) {
                    updateData.maxEmployeesOverride =
                        data.maxEmployeesOverride === null
                            ? null
                            : parseInt(data.maxEmployeesOverride);
                }
                if (data.maxStorageOverride !== undefined) {
                    updateData.maxStorageOverride =
                        data.maxStorageOverride === null
                            ? null
                            : parseInt(data.maxStorageOverride);
                }

                if (Object.keys(updateData).length === 0) {
                    return NextResponse.json(
                        {
                            error: "Provide maxEmployeesOverride or maxStorageOverride",
                        },
                        { status: 400 }
                    );
                }

                result = await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: updateData,
                    include: { plan: true },
                });

                await logPlatformAction({
                    adminId: auth.adminId,
                    action: "subscription.override_limits",
                    targetType: "subscription",
                    targetId: subscription.id,
                    metadata: {
                        organizationId: orgId,
                        overrides: updateData,
                        reason:
                            data.reason || "Enterprise custom limit override",
                    },
                    ipAddress:
                        request.headers.get("x-forwarded-for") || undefined,
                    userAgent:
                        request.headers.get("user-agent") || undefined,
                });

                break;
            }

            case "extend_trial": {
                const { days } = data;
                if (!days || days < 1 || days > 90) {
                    return NextResponse.json(
                        { error: "days must be between 1 and 90" },
                        { status: 400 }
                    );
                }

                const newTrialEnd = new Date(
                    (subscription.trialEnd || new Date()).getTime() +
                        days * 24 * 60 * 60 * 1000
                );

                result = await prisma.$transaction([
                    prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            status: "trialing",
                            trialEnd: newTrialEnd,
                            currentPeriodEnd: newTrialEnd,
                        },
                    }),
                    prisma.organization.update({
                        where: { id: orgId },
                        data: { trialEndsAt: newTrialEnd },
                    }),
                ]);

                await logPlatformAction({
                    adminId: auth.adminId,
                    action: "subscription.extend_trial",
                    targetType: "subscription",
                    targetId: subscription.id,
                    metadata: {
                        organizationId: orgId,
                        additionalDays: days,
                        newTrialEnd: newTrialEnd.toISOString(),
                        reason: data.reason || "Trial extension",
                    },
                    ipAddress:
                        request.headers.get("x-forwarded-for") || undefined,
                    userAgent:
                        request.headers.get("user-agent") || undefined,
                });

                break;
            }

            case "force_cancel": {
                result = await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: "canceled" },
                });

                await logPlatformAction({
                    adminId: auth.adminId,
                    action: "subscription.force_cancel",
                    targetType: "subscription",
                    targetId: subscription.id,
                    metadata: {
                        organizationId: orgId,
                        previousStatus: subscription.status,
                        reason: data.reason || "Admin-forced cancellation",
                    },
                    ipAddress:
                        request.headers.get("x-forwarded-for") || undefined,
                    userAgent:
                        request.headers.get("user-agent") || undefined,
                });

                break;
            }

            default:
                return NextResponse.json(
                    {
                        error: `Unknown action: ${action}. Valid actions: change_plan, override_limits, extend_trial, force_cancel`,
                    },
                    { status: 400 }
                );
        }

        // Invalidate cached subscription data
        await invalidateSubscription(orgId);

        return NextResponse.json({
            success: true,
            action,
            subscription: result,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_SUBSCRIPTION] Error:");
        return NextResponse.json(
            { error: "Failed to update subscription" },
            { status: 500 }
        );
    }
}
