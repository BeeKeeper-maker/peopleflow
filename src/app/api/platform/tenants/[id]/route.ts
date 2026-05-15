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
import { readdir, stat } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
    verifyPlatformRequest,
    isPlatformVerified,
} from "@/lib/platform-token";
import { logPlatformAction } from "@/lib/platform-auth";
import { toPlainSettings } from "@/lib/settings-json";
import { invalidateOrgStatus, invalidateSubscription } from "@/lib/redis";
import { apiLogger } from "@/lib/logger";


async function folderSizeBytes(dir: string): Promise<number> {
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        const sizes = await Promise.all(entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) return folderSizeBytes(fullPath);
            const info = await stat(fullPath);
            return info.size;
        }));
        return sizes.reduce((sum, size) => sum + size, 0);
    } catch {
        return 0;
    }
}

function latestMetric(records: Array<{ metric: string; value: number }>, metric: string) {
    return records.find((record) => record.metric === metric)?.value ?? 0;
}

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

        const storageBytes = await folderSizeBytes(path.join(process.cwd(), "uploads", orgId));
        const storageMB = Math.round((storageBytes / 1024 / 1024) * 100) / 100;

        const settings = toPlainSettings(org.settings);
        const saasOverrides =
            typeof settings.saasOverrides === "object" && settings.saasOverrides !== null && !Array.isArray(settings.saasOverrides)
                ? (settings.saasOverrides as Record<string, unknown>)
                : {};
        const customLimitOverrides =
            typeof saasOverrides.limits === "object" && saasOverrides.limits !== null && !Array.isArray(saasOverrides.limits)
                ? (saasOverrides.limits as Record<string, number>)
                : {};
        const featureOverrides =
            typeof saasOverrides.features === "object" && saasOverrides.features !== null && !Array.isArray(saasOverrides.features)
                ? (saasOverrides.features as Record<string, boolean>)
                : {};

        // Calculate effective plan limits after platform-owner custom deals.
        const plan = subscription?.plan;
        const effectiveLimits = plan
            ? {
                  maxEmployees: subscription?.maxEmployeesOverride ?? plan.maxEmployees,
                  maxAdmins: customLimitOverrides.maxAdmins ?? plan.maxAdmins,
                  maxBranches: customLimitOverrides.maxBranches ?? plan.maxBranches,
                  maxDevices: customLimitOverrides.maxDevices ?? plan.maxDevices,
                  maxStorageMB: subscription?.maxStorageOverride ?? plan.maxStorageMB,
              }
            : null;
        const effectiveFeatures = plan
            ? { ...(plan.features as Record<string, boolean>), ...featureOverrides }
            : {};

        const usagePercentage = (current: number, limit: number) =>
            limit === -1 ? 0 : Math.round((current / Math.max(limit, 1)) * 100);

        const planUsage = effectiveLimits
            ? {
                  employees: {
                      current: employeeCount,
                      limit: effectiveLimits.maxEmployees,
                      percentage: usagePercentage(employeeCount, effectiveLimits.maxEmployees),
                  },
                  users: {
                      current: userCount,
                      limit: effectiveLimits.maxAdmins,
                      percentage: usagePercentage(userCount, effectiveLimits.maxAdmins),
                  },
                  branches: {
                      current: branchCount,
                      limit: effectiveLimits.maxBranches,
                      percentage: usagePercentage(branchCount, effectiveLimits.maxBranches),
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
                      maxEmployeesOverride: subscription.maxEmployeesOverride,
                      maxStorageOverride: subscription.maxStorageOverride,
                      customLimitOverrides,
                      featureOverrides,
                      effectiveLimits,
                      effectiveFeatures,
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
            usageSummary: {
                employees: employeeCount,
                users: userCount,
                branches: branchCount,
                departments: departmentCount,
                storageMB,
                storageBytes,
                emailsSent: latestMetric(usageRecords, "emails_sent"),
                imagesUploaded: latestMetric(usageRecords, "images_uploaded"),
                apiCalls: latestMetric(usageRecords, "api_calls"),
                featureEvents: usageRecords
                    .filter((record) => record.metric.startsWith("feature."))
                    .slice(0, 12)
                    .map((record) => ({ metric: record.metric.replace(/^feature\./, ""), value: record.value, recordedAt: record.recordedAt })),
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
