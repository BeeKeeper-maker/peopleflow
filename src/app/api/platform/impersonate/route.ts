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

/**
 * POST: Start an impersonation session
 */
export async function POST(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    try {
        const body = await request.json();
        const { targetUserId, targetOrganizationId, reason } = body;

        if (!targetUserId || !targetOrganizationId || !reason) {
            return NextResponse.json(
                {
                    error: "targetUserId, targetOrganizationId, and reason are required",
                },
                { status: 400 }
            );
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
