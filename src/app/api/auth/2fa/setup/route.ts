import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getApiUser } from "@/lib/auth";
import { generateSecret, generateURI, verify as verifyTOTP } from "otplib";
import QRCode from "qrcode";

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
        console.error("2FA setup error:", error);
        return NextResponse.json(
            { error: "Failed to set up two-factor authentication" },
            { status: 500 }
        );
    }
}

/**
 * DELETE — Disable 2FA
 */
export async function DELETE() {
    try {
        const auth = await getApiUser();
        if (!auth) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        await prisma.user.update({
            where: { id: auth.user.id },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
            },
        });

        return NextResponse.json({
            message: "Two-factor authentication has been disabled",
        });
    } catch (error) {
        console.error("2FA disable error:", error);
        return NextResponse.json(
            { error: "Failed to disable two-factor authentication" },
            { status: 500 }
        );
    }
}
