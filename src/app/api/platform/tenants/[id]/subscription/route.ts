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
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
    verifyPlatformRequest,
    isPlatformVerified,
} from "@/lib/platform-token";
import { logPlatformAction } from "@/lib/platform-auth";
import { toPlainSettings } from "@/lib/settings-json";
import { invalidateSubscription } from "@/lib/redis";
import { apiLogger } from "@/lib/logger";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

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
                    adminId: auth.admin.id,
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
                const subscriptionUpdate: Record<string, number | null> = {};
                const settingsLimitUpdates: Record<string, number | null> = {};

                const parseLimit = (value: unknown, field: string) => {
                    if (value === null || value === "") return null;
                    const parsed = Number.parseInt(String(value), 10);
                    if (!Number.isInteger(parsed) || parsed < -1) {
                        throw new Error(`${field} must be -1, 0, or a positive integer`);
                    }
                    return parsed;
                };

                if (data.maxEmployeesOverride !== undefined) {
                    subscriptionUpdate.maxEmployeesOverride = parseLimit(
                        data.maxEmployeesOverride,
                        "maxEmployeesOverride",
                    );
                }
                if (data.maxStorageOverride !== undefined) {
                    subscriptionUpdate.maxStorageOverride = parseLimit(
                        data.maxStorageOverride,
                        "maxStorageOverride",
                    );
                }
                for (const field of ["maxAdmins", "maxBranches", "maxDevices"] as const) {
                    if (data[field] !== undefined) {
                        settingsLimitUpdates[field] = parseLimit(data[field], field);
                    }
                }

                if (Object.keys(subscriptionUpdate).length === 0 && Object.keys(settingsLimitUpdates).length === 0) {
                    return NextResponse.json(
                        { error: "Provide at least one custom limit override" },
                        { status: 400 },
                    );
                }

                const org = await prisma.organization.findUnique({
                    where: { id: orgId },
                    select: { settings: true },
                });
                if (!org) {
                    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
                }

                const settings = toPlainSettings(org.settings);
                const currentSaasOverrides =
                    typeof settings.saasOverrides === "object" && settings.saasOverrides !== null && !Array.isArray(settings.saasOverrides)
                        ? (settings.saasOverrides as Record<string, unknown>)
                        : {};
                const currentLimits =
                    typeof currentSaasOverrides.limits === "object" && currentSaasOverrides.limits !== null && !Array.isArray(currentSaasOverrides.limits)
                        ? (currentSaasOverrides.limits as Record<string, unknown>)
                        : {};

                for (const [key, value] of Object.entries(settingsLimitUpdates)) {
                    if (value === null) delete currentLimits[key];
                    else currentLimits[key] = value;
                }

                const newSettings = {
                    ...settings,
                    saasOverrides: {
                        ...currentSaasOverrides,
                        limits: currentLimits,
                    },
                };

                const [, updatedSubscription] = await prisma.$transaction([
                    prisma.organization.update({
                        where: { id: orgId },
                        data: { settings: newSettings as Prisma.InputJsonValue },
                    }),
                    prisma.subscription.update({
                        where: { id: subscription.id },
                        data: subscriptionUpdate,
                        include: { plan: true },
                    }),
                ]);
                result = updatedSubscription;

                await logPlatformAction({
                    adminId: auth.admin.id,
                    action: "subscription.override_limits",
                    targetType: "subscription",
                    targetId: subscription.id,
                    metadata: {
                        organizationId: orgId,
                        subscriptionOverrides: subscriptionUpdate,
                        settingsLimitOverrides: settingsLimitUpdates,
                        reason: data.reason || "Enterprise custom limit override",
                    },
                    ipAddress: request.headers.get("x-forwarded-for") || undefined,
                    userAgent: request.headers.get("user-agent") || undefined,
                });

                break;
            }

            case "override_features": {
                const { featureOverrides } = data;
                if (typeof featureOverrides !== "object" || featureOverrides === null || Array.isArray(featureOverrides)) {
                    return NextResponse.json(
                        { error: "featureOverrides must be an object of feature keys and boolean/null values" },
                        { status: 400 },
                    );
                }

                const org = await prisma.organization.findUnique({
                    where: { id: orgId },
                    select: { settings: true },
                });
                if (!org) {
                    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
                }

                const settings = toPlainSettings(org.settings);
                const currentSaasOverrides =
                    typeof settings.saasOverrides === "object" && settings.saasOverrides !== null && !Array.isArray(settings.saasOverrides)
                        ? (settings.saasOverrides as Record<string, unknown>)
                        : {};
                const currentFeatures =
                    typeof currentSaasOverrides.features === "object" && currentSaasOverrides.features !== null && !Array.isArray(currentSaasOverrides.features)
                        ? (currentSaasOverrides.features as Record<string, unknown>)
                        : {};

                for (const [key, value] of Object.entries(featureOverrides as Record<string, unknown>)) {
                    if (value === null) delete currentFeatures[key];
                    else if (typeof value === "boolean") currentFeatures[key] = value;
                    else {
                        return NextResponse.json(
                            { error: `Feature override '${key}' must be true, false, or null` },
                            { status: 400 },
                        );
                    }
                }

                const newSettings = {
                    ...settings,
                    saasOverrides: {
                        ...currentSaasOverrides,
                        features: currentFeatures,
                    },
                };

                await prisma.organization.update({
                    where: { id: orgId },
                    data: { settings: newSettings as Prisma.InputJsonValue },
                });
                result = await prisma.subscription.findUnique({
                    where: { id: subscription.id },
                    include: { plan: true },
                });

                await logPlatformAction({
                    adminId: auth.admin.id,
                    action: "subscription.override_features",
                    targetType: "subscription",
                    targetId: subscription.id,
                    metadata: {
                        organizationId: orgId,
                        featureOverrides,
                        reason: data.reason || "Custom feature access override",
                    },
                    ipAddress: request.headers.get("x-forwarded-for") || undefined,
                    userAgent: request.headers.get("user-agent") || undefined,
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
                    adminId: auth.admin.id,
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
                    adminId: auth.admin.id,
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
                        error: `Unknown action: ${action}. Valid actions: change_plan, override_limits, override_features, extend_trial, force_cancel`,
                    },
                    { status: 400 }
                );
        }

        // Invalidate cached subscription data so module access changes apply
        // immediately without killing active tenant sessions. The previous
        // sessionVersion bump made existing browser sessions return 401 until
        // users signed in again after a platform-admin feature toggle.
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
