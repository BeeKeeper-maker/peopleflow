import { NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { generateRecoveryCodes, getRemainingCodeCount } from "@/lib/recovery-codes";
import { createAuditLog } from "@/lib/audit-log";
import { authLogger } from "@/lib/logger";

/**
 * GET /api/auth/2fa/recovery-codes — Get recovery code status
 *
 * Returns:
 *   - remaining: number of unused codes (NOT the codes themselves)
 *   - generatedAt: when codes were last generated
 *   - lowWarning: true if < 3 codes remain
 *
 * The actual codes are NEVER returned again after initial generation.
 * User must regenerate to get new codes (invalidates all old ones).
 */
export async function GET() {
    try {
        const auth = await getApiUser();
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = auth.user;

        if (!user.twoFactorEnabled) {
            return NextResponse.json(
                { error: "Two-factor authentication is not enabled" },
                { status: 400 },
            );
        }

        const remaining = getRemainingCodeCount(user.twoFactorRecoveryCodes || []);

        return NextResponse.json({
            remaining,
            generatedAt: user.twoFactorRecoveryCodesGeneratedAt,
            lowWarning: remaining < 3,
            totalGenerated: 10, // initial generation count
        });
    } catch (error) {
        authLogger.error({ err: error }, "GET recovery codes error:");
        return NextResponse.json(
            { error: "Failed to fetch recovery code status" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/auth/2fa/recovery-codes — Regenerate recovery codes
 *
 * Invalidates ALL existing recovery codes and generates 10 new ones.
 * The new codes are returned (plaintext, shown ONCE).
 *
 * Requires 2FA to be enabled.
 * Audit-logged for security.
 *
 * Body: { "confirmRegenerate": true } — must explicitly confirm
 */
export async function POST(request: Request) {
    try {
        const auth = await getApiUser();
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = auth.user;

        if (!user.twoFactorEnabled) {
            return NextResponse.json(
                { error: "Two-factor authentication is not enabled" },
                { status: 400 },
            );
        }

        const body = await request.json().catch(() => ({}));
        if (!body?.confirmRegenerate) {
            return NextResponse.json(
                {
                    error: "Please confirm regeneration by setting confirmRegenerate: true. This will invalidate all existing recovery codes.",
                    code: "CONFIRMATION_REQUIRED",
                },
                { status: 400 },
            );
        }

        // Generate new codes
        const { plaintext, hashes } = await generateRecoveryCodes();

        // Update user with new hashes
        await withTenant(auth.organizationId, (db) =>
            db.user.update({
                where: { id: user.id },
                data: {
                    twoFactorRecoveryCodes: hashes,
                    twoFactorRecoveryCodesGeneratedAt: new Date(),
                },
            }),
        );

        // Audit log
        await createAuditLog({
            organizationId: user.organizationId || "",
            action: "update",
            entityType: "User",
            entityId: user.id,
            newValues: { action: "2fa_recovery_codes_regenerated" },
            userId: user.id,
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        }).catch(() => {});

        authLogger.info(
            { userId: user.id },
            "2FA recovery codes regenerated",
        );

        return NextResponse.json({
            recoveryCodes: plaintext,
            recoveryCodeWarning: "Save these recovery codes in a safe place. Each code can only be used once. Your previous recovery codes are no longer valid.",
            generatedAt: new Date().toISOString(),
            remaining: plaintext.length,
        });
    } catch (error) {
        authLogger.error({ err: error }, "Regenerate recovery codes error:");
        return NextResponse.json(
            { error: "Failed to regenerate recovery codes" },
            { status: 500 },
        );
    }
}
