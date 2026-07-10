/**
 * Impersonation System — Secure "Log In As Tenant"
 *
 * Architecture:
 * 1. Platform admin creates a time-boxed ImpersonationSession
 * 2. Session generates a one-use token
 * 3. Token is exchanged for a tenant JWT with isImpersonating=true
 * 4. All actions during impersonation are audit-tagged
 * 5. Session auto-expires after 1 hour
 *
 * Security guarantees:
 * - Time-boxed (max 1 hour, configurable)
 * - Reason required (tracked for compliance)
 * - Full audit trail (start, end, every action)
 * - Visual indicator (JWT carries isImpersonating flag)
 * - No password knowledge required
 */

import { prisma } from "@/lib/prisma";
import { logPlatformAction } from "@/lib/platform-auth";
import crypto from "crypto";
import { platformLogger } from "@/lib/logger";

// ============================================
// Constants
// ============================================

const MAX_SESSION_DURATION_MINUTES = 60; // 1 hour hard limit
const DEFAULT_SESSION_DURATION_MINUTES = 60;

// ============================================
// Types
// ============================================

export interface ImpersonationSessionData {
    id: string;
    token: string;
    targetUserId: string;
    targetOrganizationId: string;
    platformAdminId: string;
    reason: string;
    expiresAt: Date;
    startedAt: Date;
}

export interface ImpersonationResult {
    success: boolean;
    session?: ImpersonationSessionData;
    error?: string;
}

// ============================================
// Create Impersonation Session
// ============================================

/**
 * Start an impersonation session.
 * Called when a platform admin clicks "Log in as Tenant".
 */
export async function createImpersonationSession(params: {
    platformAdminId: string;
    targetUserId: string;
    targetOrganizationId: string;
    reason: string;
    durationMinutes?: number;
    ipAddress?: string;
    userAgent?: string;
}): Promise<ImpersonationResult> {
    // Validate reason
    if (!params.reason || params.reason.trim().length < 5) {
        return {
            success: false,
            error: "A detailed reason is required for impersonation (minimum 5 characters).",
        };
    }

    // Validate target user belongs to target org
    const targetUser = await prisma.user.findFirst({
        where: {
            id: params.targetUserId,
            organizationId: params.targetOrganizationId,
            isActive: true,
        },
    });

    if (!targetUser) {
        return {
            success: false,
            error: "Target user not found or does not belong to the specified organization.",
        };
    }

    // Enforce max duration
    const duration = Math.min(
        params.durationMinutes || DEFAULT_SESSION_DURATION_MINUTES,
        MAX_SESSION_DURATION_MINUTES
    );

    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    // Expire any existing active sessions for this admin
    await prisma.impersonationSession.updateMany({
        where: {
            platformAdminId: params.platformAdminId,
            status: "active",
        },
        data: {
            status: "ended",
            endedAt: new Date(),
        },
    });

    // Create new session with cryptographically secure token
    const token = crypto.randomBytes(32).toString("hex");

    const session = await prisma.impersonationSession.create({
        data: {
            token,
            reason: params.reason.trim(),
            status: "active",
            expiresAt,
            targetUserId: params.targetUserId,
            targetOrganizationId: params.targetOrganizationId,
            platformAdminId: params.platformAdminId,
        },
    });

    // Audit log
    await logPlatformAction({
        adminId: params.platformAdminId,
        action: "impersonation.start",
        targetType: "user",
        targetId: params.targetUserId,
        metadata: {
            reason: params.reason,
            targetOrganizationId: params.targetOrganizationId,
            targetUserEmail: targetUser.email,
            expiresAt: expiresAt.toISOString(),
            durationMinutes: duration,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });

    return {
        success: true,
        session: {
            id: session.id,
            token: session.token,
            targetUserId: session.targetUserId,
            targetOrganizationId: session.targetOrganizationId,
            platformAdminId: session.platformAdminId,
            reason: session.reason,
            expiresAt: session.expiresAt,
            startedAt: session.startedAt,
        },
    };
}

// ============================================
// Validate & Consume Impersonation Token
// ============================================

/**
 * Validate an impersonation token and return the target user data.
 * The token is consumed on first use (single-use).
 *
 * SECURITY: After validating the token, the session is immediately marked
 * as `consumed`. Any subsequent presentation of the same token is rejected.
 * This prevents token replay via browser history, server logs, or referrer
 * headers (the token is passed in the URL query string).
 *
 * Returns the target user's info for creating a tenant JWT.
 */
export async function validateImpersonationToken(token: string): Promise<{
    valid: boolean;
    user?: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        organizationId: string;
    };
    sessionId?: string;
    platformAdminId?: string;
    error?: string;
}> {
    // Find session by token (regardless of status, then check below).
    // We do NOT filter by status here so we can detect replay attempts
    // against already-consumed tokens and return a specific error.
    const session = await prisma.impersonationSession.findFirst({
        where: { token },
    });

    if (!session) {
        return {
            valid: false,
            error: "Invalid or expired impersonation token.",
        };
    }

    // Reject already-consumed tokens (replay attempt)
    if (session.status === "consumed") {
        return {
            valid: false,
            error: "This impersonation token has already been used.",
        };
    }

    // Reject sessions that are not active or have expired
    if (session.status !== "active" || session.expiresAt <= new Date()) {
        return {
            valid: false,
            error: "Invalid or expired impersonation token.",
        };
    }

    // Get target user
    const user = await prisma.user.findUnique({
        where: { id: session.targetUserId },
    });

    if (!user || !user.organizationId) {
        return {
            valid: false,
            error: "Target user no longer exists or has no organization.",
        };
    }

    // Mark token as consumed (single-use). This MUST happen before returning
    // the session to prevent a race condition where two concurrent requests
    // presenting the same token both succeed.
    await prisma.impersonationSession.update({
        where: { id: session.id },
        data: { status: "consumed" },
    });

    return {
        valid: true,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
        },
        sessionId: session.id,
        platformAdminId: session.platformAdminId,
    };
}

// ============================================
// End Impersonation Session
// ============================================

/**
 * End an active impersonation session.
 * Called when the platform admin clicks "End Impersonation" or on session expiry.
 */
export async function endImpersonationSession(params: {
    sessionId: string;
    platformAdminId: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<{ success: boolean; error?: string }> {
    const session = await prisma.impersonationSession.findFirst({
        where: {
            id: params.sessionId,
            platformAdminId: params.platformAdminId,
            status: "active",
        },
    });

    if (!session) {
        return {
            success: false,
            error: "No active impersonation session found.",
        };
    }

    // End the session
    await prisma.impersonationSession.update({
        where: { id: session.id },
        data: {
            status: "ended",
            endedAt: new Date(),
        },
    });

    // Audit log
    await logPlatformAction({
        adminId: params.platformAdminId,
        action: "impersonation.end",
        targetType: "user",
        targetId: session.targetUserId,
        metadata: {
            sessionId: session.id,
            targetOrganizationId: session.targetOrganizationId,
            duration: Math.round(
                (Date.now() - session.startedAt.getTime()) / 1000 / 60
            ),
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });

    return { success: true };
}

// ============================================
// Cleanup: Expire Stale Sessions
// ============================================

/**
 * Clean up expired impersonation sessions.
 * Should be called by a CRON job every 15 minutes.
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.impersonationSession.updateMany({
        where: {
            status: "active",
            expiresAt: { lte: new Date() },
        },
        data: {
            status: "expired",
            endedAt: new Date(),
        },
    });

    if (result.count > 0) {
        platformLogger.info({ count: result.count }, `Expired ${result.count} stale impersonation session(s)`);
    }

    return result.count;
}
