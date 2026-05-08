import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/auth";
import { sendEmail, emailTemplates } from "@/lib/email";
import bcrypt from "bcryptjs";
import { authLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

const PASSWORD_HISTORY_LIMIT = 5;

export async function POST(request: Request) {
    try {
        // Rate limit: max 5 reset attempts per hour per IP
        const rl = await rateLimit(request, RATE_LIMIT_CONFIGS.sensitive, "auth/reset-password");
        if (!rl.allowed) return rl.response!;

        const { token, password, confirmPassword } = await request.json();

        if (!token || !password) {
            return NextResponse.json(
                { error: "Token and password are required" },
                { status: 400 }
            );
        }

        if (password !== confirmPassword) {
            return NextResponse.json(
                { error: "Passwords do not match" },
                { status: 400 }
            );
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return NextResponse.json(
                { error: passwordValidation.errors[0] },
                { status: 400 }
            );
        }

        // Find valid token
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!resetToken) {
            return NextResponse.json(
                { error: "Invalid or expired reset link" },
                { status: 400 }
            );
        }

        if (resetToken.used) {
            return NextResponse.json(
                { error: "This reset link has already been used" },
                { status: 400 }
            );
        }

        if (new Date() > resetToken.expiresAt) {
            return NextResponse.json(
                { error: "This reset link has expired. Please request a new one." },
                { status: 400 }
            );
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: resetToken.email },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Check password history (prevent reuse of last 5 passwords)
        const passwordHistory = await prisma.passwordHistory.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: PASSWORD_HISTORY_LIMIT,
        });

        for (const entry of passwordHistory) {
            const isReused = await bcrypt.compare(password, entry.hash);
            if (isReused) {
                return NextResponse.json(
                    { error: `Cannot reuse your last ${PASSWORD_HISTORY_LIMIT} passwords. Please choose a new one.` },
                    { status: 400 }
                );
            }
        }

        // Also check current password
        if (user.password) {
            const isSameAsCurrent = await bcrypt.compare(password, user.password);
            if (isSameAsCurrent) {
                return NextResponse.json(
                    { error: "New password cannot be the same as your current password" },
                    { status: 400 }
                );
            }
        }

        // Hash new password
        const hashedPassword = await hashPassword(password);

        // Update password, save history, mark token as used — all in transaction
        await prisma.$transaction([
            // Update user password
            prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                    emailVerified: user.emailVerified ?? new Date(),
                    sessionVersion: { increment: 1 },
                },
            }),
            // Save old password to history (if exists)
            ...(user.password
                ? [
                    prisma.passwordHistory.create({
                        data: {
                            hash: user.password,
                            userId: user.id,
                        },
                    }),
                ]
                : []),
            // Invalidate database sessions; JWT sessions are invalidated by sessionVersion.
            prisma.session.deleteMany({
                where: { userId: user.id },
            }),
            // Mark token as used
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { used: true },
            }),
            // Clean up old password history (keep only last N)
            // This is done separately below
        ]);

        // Clean up old history entries beyond limit
        const allHistory = await prisma.passwordHistory.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
        });
        if (allHistory.length > PASSWORD_HISTORY_LIMIT) {
            const toDelete = allHistory.slice(PASSWORD_HISTORY_LIMIT).map((h) => h.id);
            await prisma.passwordHistory.deleteMany({
                where: { id: { in: toDelete } },
            });
        }

        // Send confirmation email
        if (user.email) {
            sendEmail({
                to: user.email,
                subject: "Password Changed Successfully",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">✅ Password Changed</h1>
                        </div>
                        <div style="padding: 30px; background: #f9fafb;">
                            <h2 style="color: #1f2937;">Hello ${user.name || "User"},</h2>
                            <p style="color: #4b5563;">
                                Your password has been successfully changed. If you did not make this change,
                                please contact your administrator immediately.
                            </p>
                        </div>
                    </div>
                `,
            }).catch((err) => authLogger.error({ err: err }, "Failed to send password change email:"));
        }

        return NextResponse.json(
            { message: "Password has been reset successfully. You can now log in with your new password." },
            { status: 200 }
        );
    } catch (error) {
        authLogger.error({ err: error }, "Reset password error:");
        return NextResponse.json(
            { error: "An error occurred. Please try again later." },
            { status: 500 }
        );
    }
}

/**
 * GET — Validate a reset token (used by the reset-password page to check before showing form)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json(
                { valid: false, error: "Token is required" },
                { status: 400 }
            );
        }

        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
            return NextResponse.json(
                { valid: false, error: "Invalid or expired reset link" },
                { status: 400 }
            );
        }

        return NextResponse.json({ valid: true });
    } catch (error) {
        authLogger.error({ err: error }, "Token validation error:");
        return NextResponse.json(
            { valid: false, error: "An error occurred" },
            { status: 500 }
        );
    }
}
