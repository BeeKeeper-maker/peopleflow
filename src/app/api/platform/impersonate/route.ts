/**
 * Platform API: Impersonation Endpoints
 *
 * POST /api/platform/impersonate — Start impersonation
 * DELETE /api/platform/impersonate — End impersonation
 */

import { NextRequest, NextResponse } from "next/server";
import {
    requirePlatformAuth,
    isPlatformAuthenticated,
} from "@/lib/platform-auth";
import {
    createImpersonationSession,
    endImpersonationSession,
} from "@/lib/impersonation";

/**
 * POST: Start an impersonation session
 */
export async function POST(request: NextRequest) {
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

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
            platformAdminId: auth.adminId,
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
        console.error("[IMPERSONATION] Start error:", error);
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
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

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
            platformAdminId: auth.adminId,
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
        console.error("[IMPERSONATION] End error:", error);
        return NextResponse.json(
            { error: "Failed to end impersonation" },
            { status: 500 }
        );
    }
}
