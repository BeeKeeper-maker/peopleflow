import { NextRequest, NextResponse } from "next/server";
import { auth, validatePassword, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authLogger } from "@/lib/logger";

const PASSWORD_HISTORY_LIMIT = 5;

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { currentPassword, newPassword } = await req.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: "Current password and new password are required" },
                { status: 400 }
            );
        }

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return NextResponse.json(
                { error: passwordValidation.errors[0] },
                { status: 400 }
            );
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user || !user.password) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return NextResponse.json(
                { error: "Current password is incorrect" },
                { status: 400 }
            );
        }

        const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
        if (isSameAsCurrent) {
            return NextResponse.json(
                { error: "New password cannot be the same as your current password" },
                { status: 400 }
            );
        }

        const passwordHistory = await prisma.passwordHistory.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: PASSWORD_HISTORY_LIMIT,
        });

        for (const entry of passwordHistory) {
            const isReused = await bcrypt.compare(newPassword, entry.hash);
            if (isReused) {
                return NextResponse.json(
                    { error: `Cannot reuse your last ${PASSWORD_HISTORY_LIMIT} passwords. Please choose a new one.` },
                    { status: 400 }
                );
            }
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password, save history, and invalidate active sessions/JWTs
        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                    sessionVersion: { increment: 1 },
                },
            }),
            prisma.passwordHistory.create({
                data: {
                    hash: user.password,
                    userId: user.id,
                },
            }),
            prisma.session.deleteMany({
                where: { userId: user.id },
            }),
        ]);

        const allHistory = await prisma.passwordHistory.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
        });
        if (allHistory.length > PASSWORD_HISTORY_LIMIT) {
            await prisma.passwordHistory.deleteMany({
                where: { id: { in: allHistory.slice(PASSWORD_HISTORY_LIMIT).map((h) => h.id) } },
            });
        }

        return NextResponse.json({ message: "Password changed successfully" });
    } catch (error) {
        authLogger.error({ err: error }, "Password change error:");
        return NextResponse.json(
            { error: "Failed to change password" },
            { status: 500 }
        );
    }
}
