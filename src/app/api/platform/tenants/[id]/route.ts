/**
 * Platform API: Single Tenant Detail
 *
 * GET /api/platform/tenants/[id]
 * PATCH /api/platform/tenants/[id] — Update tenant metadata
 * DELETE /api/platform/tenants/[id] — Deactivate tenant (soft delete)
 *
 * Returns complete tenant profile with subscription, billing history,
 * resource usage, and latest activity. Platform admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    verifyPlatformRequest,
    isPlatformVerified,
} from "@/lib/platform-token";
import { logPlatformAction } from "@/lib/platform-auth";
import { invalidateOrgStatus, invalidateSubscription } from "@/lib/redis";
import { apiLogger } from "@/lib/logger";

// ============================================
// GET: Full tenant detail
// ============================================

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    const { id: orgId } = await params;

    try {
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
        });

        if (!org) {
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404 }
            );
        }

        // Fetch related data in parallel
        const [
            subscription,
            employeeCount,
            userCount,
            branchCount,
            departmentCount,
            adminUsers,
            usageRecords,
            impersonationHistory,
        ] = await Promise.all([
            prisma.subscription.findUnique({
                where: { organizationId: orgId },
                include: {
                    plan: true,
                    invoices: {
                        orderBy: { createdAt: "desc" as const },
                        take: 10,
                    },
                },
            }),
            prisma.employee.count({ where: { organizationId: orgId } }),
            prisma.user.count({ where: { organizationId: orgId } }),
            prisma.branch.count({ where: { organizationId: orgId } }),
            prisma.department.count({ where: { organizationId: orgId } }),
            prisma.user.findMany({
                where: {
                    organizationId: orgId,
                    role: { in: ["admin", "hr_admin"] },
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    lastLogin: true,
                    isActive: true,
                },
                take: 10,
            }),
            prisma.usageRecord.findMany({
                where: { organizationId: orgId },
                orderBy: { recordedAt: "desc" },
                take: 30,
            }),
            prisma.impersonationSession.findMany({
                where: { targetOrganizationId: orgId },
                orderBy: { startedAt: "desc" },
                take: 5,
                include: {
                    platformAdmin: {
                        select: { name: true, email: true },
                    },
                },
            }),
        ]);

        // Calculate plan usage percentages
        const plan = subscription?.plan;
        const planUsage = plan
            ? {
                  employees: {
                      current: employeeCount,
                      limit: plan.maxEmployees,
                      percentage:
                          plan.maxEmployees === -1
                              ? 0
                              : Math.round(
                                    (employeeCount / plan.maxEmployees) * 100
                                ),
                  },
                  users: {
                      current: userCount,
                      limit: plan.maxAdmins,
                      percentage:
                          plan.maxAdmins === -1
                              ? 0
                              : Math.round(
                                    (userCount / plan.maxAdmins) * 100
                                ),
                  },
                  branches: {
                      current: branchCount,
                      limit: plan.maxBranches,
                      percentage:
                          plan.maxBranches === -1
                              ? 0
                              : Math.round(
                                    (branchCount / plan.maxBranches) * 100
                                ),
                  },
              }
            : null;

        return NextResponse.json({
            tenant: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                status: org.status,
                countryCode: org.countryCode,
                currencyCode: org.currencyCode,
                suspendedAt: org.suspendedAt,
                suspendedReason: org.suspendedReason,
                onboardedAt: org.onboardedAt,
                trialEndsAt: org.trialEndsAt,
                createdAt: org.createdAt,
                updatedAt: org.updatedAt,
            },
            subscription: subscription
                ? {
                      id: subscription.id,
                      status: subscription.status,
                      billingCycle: subscription.billingCycle,
                      currentPeriodStart: subscription.currentPeriodStart,
                      currentPeriodEnd: subscription.currentPeriodEnd,
                      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                      trialStart: subscription.trialStart,
                      trialEnd: subscription.trialEnd,
                      stripeCustomerId: subscription.stripeCustomerId,
                      plan: subscription.plan,
                  }
                : null,
            billing: {
                invoices: subscription?.invoices || [],
            },
            planUsage,
            admins: adminUsers,
            resourceCounts: {
                employees: employeeCount,
                users: userCount,
                branches: branchCount,
                departments: departmentCount,
            },
            usageRecords,
            impersonationHistory,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_TENANT_DETAIL] Error:");
        return NextResponse.json(
            { error: "Failed to fetch tenant details" },
            { status: 500 }
        );
    }
}

// ============================================
// PATCH: Update tenant metadata
// ============================================

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    const { id: orgId } = await params;

    try {
        const body = await request.json();
        const allowedFields = [
            "name",
            "countryCode",
            "currencyCode",
            "trialEndsAt",
        ];

        // Only allow whitelisted fields
        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] =
                    field === "trialEndsAt"
                        ? new Date(body[field])
                        : body[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        const org = await prisma.organization.update({
            where: { id: orgId },
            data: updateData,
        });

        // Audit log
        await logPlatformAction({
            adminId: auth.admin.id,
            action: "tenant.update",
            targetType: "organization",
            targetId: orgId,
            metadata: { updatedFields: Object.keys(updateData), ...updateData },
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        return NextResponse.json({
            success: true,
            tenant: {
                id: org.id,
                name: org.name,
                status: org.status,
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_TENANT_UPDATE] Error:");
        return NextResponse.json(
            { error: "Failed to update tenant" },
            { status: 500 }
        );
    }
}

// ============================================
// DELETE: Soft-deactivate a tenant
// ============================================

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    const { id: orgId } = await params;

    try {
        const body = await request.json().catch(() => ({}));
        const reason = (body as Record<string, string>).reason || "Manual deactivation by platform admin";

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
        });

        if (!org) {
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404 }
            );
        }

        if (org.status === "deactivated") {
            return NextResponse.json(
                { error: "Tenant is already deactivated" },
                { status: 400 }
            );
        }

        // Soft deactivate — DO NOT cascade delete. Data preserved.
        await prisma.$transaction([
            prisma.organization.update({
                where: { id: orgId },
                data: {
                    status: "deactivated",
                    suspendedAt: new Date(),
                    suspendedReason: reason,
                },
            }),
            prisma.subscription.updateMany({
                where: { organizationId: orgId },
                data: { status: "canceled" },
            }),
        ]);

        await logPlatformAction({
            adminId: auth.admin.id,
            action: "tenant.deactivate",
            targetType: "organization",
            targetId: orgId,
            metadata: {
                reason,
                organizationName: org.name,
                previousStatus: org.status,
            },
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        await invalidateOrgStatus(orgId);
        await invalidateSubscription(orgId);

        return NextResponse.json({
            success: true,
            message: `Tenant '${org.name}' has been deactivated`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_TENANT_DELETE] Error:");
        return NextResponse.json(
            { error: "Failed to deactivate tenant" },
            { status: 500 }
        );
    }
}
