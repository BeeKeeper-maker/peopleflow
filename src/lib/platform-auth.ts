/**
 * Platform Admin Authentication — Auth.js v5 (Separate Security Plane)
 *
 * Completely decoupled from tenant auth (src/lib/auth.ts).
 * Uses its own:
 *   - PlatformAdmin table (not User)
 *   - JWT namespace (isPlatform: true)
 *   - Cookie name (pf-platform.session-token)
 *   - Login page (/platform/login)
 *
 * Phase 0.3: Added 2FA (TOTP) support for platform admins.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { verify as verifyTOTP } from "otplib";
import { NextResponse } from "next/server";
import { platformLogger } from "@/lib/logger";

// ── Auth.js v5 Platform Instance ─────────────────────────────────

const {
    handlers: platformHandlers,
    auth: platformAuth,
    signIn: platformSignIn,
    signOut: platformSignOut,
} = NextAuth({
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // 8 hours — tighter than tenant sessions
    },
    pages: {
        signIn: "/platform/login",
        error: "/platform/login",
    },
    cookies: {
        sessionToken: {
            name: "pf-platform.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
            },
        },
    },
    providers: [
        Credentials({
            id: "platform-credentials",
            name: "Platform Admin",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                totpCode: { label: "2FA Code", type: "text" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }

                const admin = await prisma.platformAdmin.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!admin || !admin.password) {
                    throw new Error("Invalid credentials");
                }

                if (!admin.isActive) {
                    throw new Error("Account is disabled");
                }

                const isValid = await compare(credentials.password as string, admin.password);
                if (!isValid) {
                    throw new Error("Invalid credentials");
                }

                // ── 2FA Verification (Phase 0.3) ──
                if (admin.twoFactorEnabled && admin.twoFactorSecret) {
                    const totpCode = credentials.totpCode as string;
                    if (!totpCode) {
                        throw new Error("2FA code required");
                    }
                    try {
                        const valid = verifyTOTP({
                            token: totpCode,
                            secret: admin.twoFactorSecret,
                        });
                        if (!valid) {
                            throw new Error("Invalid 2FA code");
                        }
                    } catch (err) {
                        if (err instanceof Error && err.message.includes("2FA")) {
                            throw err;
                        }
                        throw new Error("Invalid 2FA code");
                    }
                }

                await prisma.platformAdmin.update({
                    where: { id: admin.id },
                    data: { lastLogin: new Date() },
                });

                return {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                    isPlatform: true,
                    twoFactorEnabled: admin.twoFactorEnabled,
                } as any;
            },
        }),
    ],
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.isPlatform = true;
                token.twoFactorEnabled = (user as any).twoFactorEnabled;
            }
            return token;
        },
        session({ session, token }) {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id as string,
                    role: token.role as string,
                    isPlatform: true,
                    twoFactorEnabled: token.twoFactorEnabled as boolean,
                },
            };
        },
    },
});

export { platformHandlers, platformAuth, platformSignIn, platformSignOut };

// ── Platform Auth Context ────────────────────────────────────────

export interface PlatformAuthContext {
    adminId: string;
    email: string;
    name: string;
    role: string;
    isPlatform: true;
}

export async function getPlatformSession(): Promise<PlatformAuthContext | null> {
    const session = await platformAuth();

    if (!session?.user?.email) return null;

    const admin = await prisma.platformAdmin.findUnique({
        where: { email: session.user.email },
    });

    if (!admin || !admin.isActive) return null;

    return {
        adminId: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isPlatform: true,
    };
}

export async function requirePlatformAuth(): Promise<PlatformAuthContext | NextResponse> {
    const ctx = await getPlatformSession();
    if (!ctx) {
        return new NextResponse(
            JSON.stringify({ error: "Platform authentication required", code: "PLATFORM_AUTH_REQUIRED" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }
    return ctx;
}

export function isPlatformAuthenticated(
    result: PlatformAuthContext | NextResponse
): result is PlatformAuthContext {
    return !(result instanceof NextResponse);
}

// ── Platform Audit Logging ───────────────────────────────────────

export async function logPlatformAction(params: {
    adminId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    try {
        await prisma.platformAuditLog.create({
            data: {
                action: params.action,
                targetType: params.targetType,
                targetId: params.targetId,
                metadata: (params.metadata || {}) as any,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                platformAdminId: params.adminId,
            },
        });
    } catch (error) {
        platformLogger.error({ err: error, action: params.action }, "Failed to log platform audit action");
    }
}
