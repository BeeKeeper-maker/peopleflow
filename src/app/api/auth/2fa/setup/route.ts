import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { authLogger } from "@/lib/logger";

/**
 * POST — Generate 2FA secret and QR code for setup
 */
export async function POST() {
    try {
        const auth = await getApiUser();
        if (!auth) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { user } = auth;

        if (user.twoFactorEnabled) {
            return NextResponse.json(
                { error: "Two-factor authentication is already enabled" },
                { status: 400 }
            );
        }

        // Generate secret
        const secret = generateSecret();
        const appName = "PeopleFlow HRMS";
        const otpauthUrl = generateURI({
            issuer: appName,
            label: user.email,
            secret,
        });

        // Generate QR code as data URL
        const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

        // Save secret temporarily (not enabled yet — requires verification)
        await prisma.user.update({
            where: { id: user.id },
            data: { twoFactorSecret: secret },
        });

        return NextResponse.json({
            secret,
            qrCodeUrl,
            message: "Scan the QR code with your authenticator app, then verify with a code.",
        });
    } catch (error) {
        authLogger.error({ err: error }, "2FA setup error:");
        return NextResponse.json(
            { error: "Failed to set up two-factor authentication" },
            { status: 500 }
        );
    }
}

/**
 * DELETE — Disable 2FA
 *
 * SECURITY: Requires re-authentication with the user's current password AND
 * a valid TOTP code (or a recovery code) before disabling 2FA. This prevents
 * a stolen session cookie from being used to silently disable 2FA and take
 * over the account.
 */
export async function DELETE(req: NextRequest) {
    try {
        const auth = await getApiUser();
        if (!auth) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const { currentPassword, totpCode, recoveryCode } = body;

        if (!currentPassword) {
            return NextResponse.json(
                { error: "Current password is required to disable 2FA" },
                { status: 400 }
            );
        }

        // Verify current password
        const user = await prisma.user.findUnique({
            where: { id: auth.user.id },
            select: {
                password: true,
                twoFactorSecret: true,
                twoFactorEnabled: true,
                twoFactorRecoveryCodes: true,
            },
        });

        if (!user || !user.password) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const bcrypt = await import("bcryptjs");
        const passwordValid = await bcrypt.compare(currentPassword, user.password);
        if (!passwordValid) {
            return NextResponse.json(
                { error: "Current password is incorrect" },
                { status: 403 }
            );
        }

        // If 2FA is enabled, verify TOTP code or recovery code
        if (user.twoFactorEnabled) {
            if (!totpCode && !recoveryCode) {
                return NextResponse.json(
                    { error: "TOTP code or recovery code is required to disable 2FA" },
                    { status: 400 }
                );
            }

            if (recoveryCode) {
                // Verify recovery code against stored hashes
                const { verifyRecoveryCode } = await import("@/lib/recovery-codes");
                const storedHashes = user.twoFactorRecoveryCodes || [];
                if (storedHashes.length === 0) {
                    return NextResponse.json(
                        { error: "No recovery codes are available" },
                        { status: 400 }
                    );
                }
                const matchIndex = await verifyRecoveryCode(recoveryCode, storedHashes);
                if (matchIndex === null) {
                    return NextResponse.json(
                        { error: "Invalid recovery code" },
                        { status: 403 }
                    );
                }
                // Consume the recovery code (single-use)
                const remainingCodes = storedHashes.filter((_, i) => i !== matchIndex);
                await prisma.user.update({
                    where: { id: auth.user.id },
                    data: { twoFactorRecoveryCodes: remainingCodes },
                });
            } else if (totpCode && user.twoFactorSecret) {
                // Verify TOTP code.
                // otplib v13's `verify` is async — it returns
                // Promise<{ valid: boolean; delta?: number }> — so we MUST
                // await it. Without `await` the Promise object is always
                // truthy and ANY TOTP code is accepted (P10-FIXES).
                const { verify: verifyTOTP } = await import("otplib");
                const result = await verifyTOTP({
                    token: totpCode,
                    secret: user.twoFactorSecret,
                });
                const isValid = result?.valid ?? false;
                if (!isValid) {
                    return NextResponse.json(
                        { error: "Invalid TOTP code" },
                        { status: 403 }
                    );
                }
            } else {
                return NextResponse.json(
                    { error: "Cannot verify 2FA — secret missing" },
                    { status: 500 }
                );
            }
        }

        await prisma.user.update({
            where: { id: auth.user.id },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        authLogger.error({ err: error }, "2FA disable error:");
        return NextResponse.json(
            { error: "Failed to disable two-factor authentication" },
            { status: 500 }
        );
    }
}
