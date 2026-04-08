/**
 * Platform API: Tenant Suspend / Activate (Kill Switch)
 *
 * PATCH /api/platform/tenants/[id]/suspend
 * PATCH /api/platform/tenants/[id]/activate
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    requirePlatformAuth,
    isPlatformAuthenticated,
    logPlatformAction,
} from "@/lib/platform-auth";
import { invalidateOrgStatus, invalidateSubscription } from "@/lib/redis";
import { apiLogger } from "@/lib/logger";

// ============================================
// SUSPEND a tenant
// ============================================

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

    const { id: orgId } = await params;

    try {
        const body = await request.json();
        const { action, reason } = body;

        if (!action || !["suspend", "activate"].includes(action)) {
            return NextResponse.json(
                { error: "action must be 'suspend' or 'activate'" },
                { status: 400 }
            );
        }

        // Verify org exists
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
        });

        if (!org) {
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404 }
            );
        }

        if (action === "suspend") {
            if (!reason || reason.trim().length < 3) {
                return NextResponse.json(
                    { error: "A reason is required for suspension" },
                    { status: 400 }
                );
            }

            if (org.status === "suspended") {
                return NextResponse.json(
                    { error: "Organization is already suspended" },
                    { status: 400 }
                );
            }

            // Execute the kill switch
            await prisma.organization.update({
                where: { id: orgId },
                data: {
                    status: "suspended",
                    suspendedAt: new Date(),
                    suspendedReason: reason.trim(),
                },
            });

            // Also suspend the subscription if active
            await prisma.subscription.updateMany({
                where: {
                    organizationId: orgId,
                    status: { in: ["active", "trialing", "past_due"] },
                },
                data: { status: "suspended" },
            });

            // Audit log
            await logPlatformAction({
                adminId: auth.adminId,
                action: "tenant.suspend",
                targetType: "organization",
                targetId: orgId,
                metadata: {
                    reason: reason.trim(),
                    organizationName: org.name,
                    previousStatus: org.status,
                },
                ipAddress:
                    request.headers.get("x-forwarded-for") || undefined,
                userAgent: request.headers.get("user-agent") || undefined,
            });

            // Invalidate caches immediately
            await invalidateOrgStatus(orgId);
            await invalidateSubscription(orgId);

            return NextResponse.json({
                success: true,
                action: "suspended",
                organization: {
                    id: orgId,
                    name: org.name,
                    status: "suspended",
                    suspendedAt: new Date().toISOString(),
                    reason: reason.trim(),
                },
            });
        }

        if (action === "activate") {
            if (org.status === "active") {
                return NextResponse.json(
                    { error: "Organization is already active" },
                    { status: 400 }
                );
            }

            // Reactivate
            await prisma.organization.update({
                where: { id: orgId },
                data: {
                    status: "active",
                    suspendedAt: null,
                    suspendedReason: null,
                },
            });

            // Reactivate subscription
            await prisma.subscription.updateMany({
                where: {
                    organizationId: orgId,
                    status: "suspended",
                },
                data: { status: "active" },
            });

            // Audit log
            await logPlatformAction({
                adminId: auth.adminId,
                action: "tenant.activate",
                targetType: "organization",
                targetId: orgId,
                metadata: {
                    organizationName: org.name,
                    previousStatus: org.status,
                    reactivationReason: reason || "Manual reactivation",
                },
                ipAddress:
                    request.headers.get("x-forwarded-for") || undefined,
                userAgent: request.headers.get("user-agent") || undefined,
            });

            // Invalidate caches
            await invalidateOrgStatus(orgId);
            await invalidateSubscription(orgId);

            return NextResponse.json({
                success: true,
                action: "activated",
                organization: {
                    id: orgId,
                    name: org.name,
                    status: "active",
                },
            });
        }
    } catch (error) {
        apiLogger.error({ err: error }, "[KILL_SWITCH] Error:");
        return NextResponse.json(
            { error: "Failed to update tenant status" },
            { status: 500 }
        );
    }
}
