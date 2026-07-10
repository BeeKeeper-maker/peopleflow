import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { verify as verifyTOTP } from "otplib";
import { generateRecoveryCodes } from "@/lib/recovery-codes";
import { authLogger } from "@/lib/logger";

/**
 * POST — Verify TOTP code to enable 2FA
 * Called after user scans QR code and enters the 6-digit code.
 *
 * On success:
 *   1. Enables twoFactorEnabled
 *   2. Generates 10 recovery codes (bcrypt-hashed, stored in DB)
 *   3. Returns plaintext recovery codes (shown ONCE in UI)
 *   4. User must save these codes — they are the ONLY way to recover
 *      access if the authenticator device is lost.
 */
export async function POST(request: Request) {
    try {
        const auth = await getApiUser();
        if (!auth) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { code } = await request.json();

        if (!code || typeof code !== "string") {
            return NextResponse.json(
                { error: "Verification code is required" },
                { status: 400 }
            );
        }

        const { user } = auth;

        if (!user.twoFactorSecret) {
            return NextResponse.json(
                { error: "Two-factor authentication has not been set up. Please go through the setup process first." },
                { status: 400 }
            );
        }

        if (user.twoFactorEnabled) {
            return NextResponse.json(
                { error: "Two-factor authentication is already enabled" },
                { status: 400 }
            );
        }

        // Verify the TOTP code
        const isValid = verifyTOTP({
            token: code,
            secret: user.twoFactorSecret,
        });

        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid verification code. Please try again." },
                { status: 400 }
            );
        }

        // Generate recovery codes
        const { plaintext, hashes } = await generateRecoveryCodes();

        // Enable 2FA + store recovery code hashes
        await prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorEnabled: true,
                twoFactorRecoveryCodes: hashes,
                twoFactorRecoveryCodesGeneratedAt: new Date(),
            },
        });

        return NextResponse.json({
            message: "Two-factor authentication has been enabled successfully!",
            enabled: true,
            recoveryCodes: plaintext,
            recoveryCodeWarning: "Save these recovery codes in a safe place. Each code can only be used once. You will not be able to see them again.",
        });    } catch (error) {
        authLogger.error({ err: error }, "2FA verify error:");
        return NextResponse.json(
            { error: "Failed to verify two-factor authentication" },
            { status: 500 }
        );
    }
}
