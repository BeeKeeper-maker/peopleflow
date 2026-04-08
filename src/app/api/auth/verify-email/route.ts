import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authLogger } from "@/lib/logger";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json(
                { error: "Verification token is required" },
                { status: 400 }
            );
        }

        // Find the token
        const verificationToken = await prisma.emailVerificationToken.findUnique({
            where: { token },
        });

        if (!verificationToken) {
            return NextResponse.json(
                { error: "Invalid verification link" },
                { status: 400 }
            );
        }

        if (new Date() > verificationToken.expiresAt) {
            // Delete expired token
            await prisma.emailVerificationToken.delete({
                where: { id: verificationToken.id },
            });
            return NextResponse.json(
                { error: "Verification link has expired. Please request a new one." },
                { status: 400 }
            );
        }

        // Update user's emailVerified field
        const user = await prisma.user.findUnique({
            where: { email: verificationToken.email },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        if (user.emailVerified) {
            // Already verified — clean up token and return success
            await prisma.emailVerificationToken.delete({
                where: { id: verificationToken.id },
            });
            return NextResponse.json(
                { message: "Email is already verified", alreadyVerified: true },
                { status: 200 }
            );
        }

        // Verify email and delete token in transaction
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: new Date() },
            }),
            prisma.emailVerificationToken.delete({
                where: { id: verificationToken.id },
            }),
        ]);

        return NextResponse.json(
            { message: "Email verified successfully! You can now log in." },
            { status: 200 }
        );
    } catch (error) {
        authLogger.error({ err: error }, "Email verification error:");
        return NextResponse.json(
            { error: "An error occurred during verification" },
            { status: 500 }
        );
    }
}

/**
 * POST — Resend verification email
 */
export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        const normalizedEmail = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        // Don't reveal if user exists
        const successResponse = NextResponse.json(
            { message: "If an unverified account exists with this email, a verification link has been sent." },
            { status: 200 }
        );

        if (!user || user.emailVerified) {
            return successResponse;
        }

        // Delete old tokens
        await prisma.emailVerificationToken.deleteMany({
            where: { email: normalizedEmail },
        });

        // Generate new token (24 hour expiry)
        const crypto = await import("crypto");
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await prisma.emailVerificationToken.create({
            data: {
                token,
                email: normalizedEmail,
                expiresAt,
            },
        });

        // Send email
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

        const { sendTemplateEmail } = await import("@/lib/email");
        sendTemplateEmail(normalizedEmail, "verifyEmail", {
            userName: user.name || "User",
            verifyUrl,
        }).catch((err) => authLogger.error({ err: err }, "Failed to send verification email:"));

        return successResponse;
    } catch (error) {
        authLogger.error({ err: error }, "Resend verification error:");
        return NextResponse.json(
            { error: "An error occurred. Please try again." },
            { status: 500 }
        );
    }
}
