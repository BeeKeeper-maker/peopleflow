/**
 * Platform API: Impersonation Endpoints
 *
 * POST /api/platform/impersonate — Start impersonation
 * DELETE /api/platform/impersonate — End impersonation
 */

import { NextRequest, NextResponse } from "next/server";
import {
    verifyPlatformRequest,
    isPlatformVerified,
} from "@/lib/platform-token";
import {
    createImpersonationSession,
    endImpersonationSession,
} from "@/lib/impersonation";
import { apiLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * POST: Start an impersonation session
 */
export async function POST(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    try {
        const body = await request.json();
        const { reason } = body;
        let { targetUserId, targetOrganizationId } = body;

        targetOrganizationId = targetOrganizationId || body.organizationId;

        if (!targetOrganizationId || !reason) {
            return NextResponse.json(
                { error: "targetOrganizationId/organizationId and reason are required" },
                { status: 400 }
            );
        }

        // Owner console can start from a tenant/company page without selecting a user.
        // In that case, impersonate the best available active company admin.
        if (!targetUserId) {
            const adminUser = await prisma.user.findFirst({
                where: {
                    organizationId: targetOrganizationId,
                    isActive: true,
                    emailVerified: { not: null },
                    role: { in: ["super_admin", "admin", "hr_admin"] },
                },
                orderBy: [
                    { role: "asc" },
                    { createdAt: "asc" },
                ],
            });

            if (!adminUser) {
                return NextResponse.json(
                    { error: "No active admin user found for this organization" },
                    { status: 404 }
                );
            }

            targetUserId = adminUser.id;
        }

        const result = await createImpersonationSession({
            platformAdminId: auth.admin.id,
            targetUserId,
            targetOrganizationId,
            reason,
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        // ── Audit logging note (P11-AUDIT-LOG) ────────────────────────
        // `createImpersonationSession` already writes a `PlatformAuditLog`
        // entry via `logPlatformAction` (action: "impersonation.start",
        // targetType: "user", targetId: targetUserId, platformAdminId,
        // metadata: { reason, targetOrganizationId, targetUserEmail,
        // expiresAt, durationMinutes }, ipAddress, userAgent). Per the
        // "don't duplicate" constraint in P11-AUDIT-LOG, no second
        // `platformAuditLog.create` is emitted here. See
        // `src/lib/impersonation.ts` lines ~128-143 for the canonical
        // log site.

        // Return the token + redirect URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const redirectUrl = `${appUrl}/auth/impersonate?token=${result.session!.token}`;

        return NextResponse.json({
            success: true,
            impersonationToken: result.session!.token,
            redirectUrl,
            expiresAt: result.session!.expiresAt.toISOString(),
            sessionId: result.session!.id,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[IMPERSONATION] Start error:");
        return NextResponse.json(
            { error: "Failed to start impersonation" },
            { status: 500 }
        );
    }
}

/**
 * DELETE: End an impersonation session
 */
export async function DELETE(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    try {
        const body = await request.json();
        const { sessionId } = body;

        if (!sessionId) {
            return NextResponse.json(
                { error: "sessionId is required" },
                { status: 400 }
            );
        }

        const result = await endImpersonationSession({
            sessionId,
            platformAdminId: auth.admin.id,
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, message: "Impersonation session ended" });
    } catch (error) {
        apiLogger.error({ err: error }, "[IMPERSONATION] End error:");
        return NextResponse.json(
            { error: "Failed to end impersonation" },
            { status: 500 }
        );
    }
}
