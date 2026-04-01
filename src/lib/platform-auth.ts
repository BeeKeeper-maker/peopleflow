/**
 * Platform Admin Authentication — Separate Security Plane
 *
 * Completely decoupled from tenant auth (src/lib/auth.ts).
 * Uses its own:
 *   - PlatformAdmin table (not User)
 *   - JWT namespace (isPlatform: true)
 *   - Cookie name (pf-platform.session-token)
 *   - Login page (/platform/login)
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

// ============================================
// Platform Auth Configuration
// ============================================

export const platformAuthOptions: NextAuthOptions = {
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
        CredentialsProvider({
            id: "platform-credentials",
            name: "Platform Admin",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }

                const admin = await prisma.platformAdmin.findUnique({
                    where: { email: credentials.email },
                });

                if (!admin || !admin.password) {
                    throw new Error("Invalid credentials");
                }

                if (!admin.isActive) {
                    throw new Error("Account is disabled");
                }

                const isValid = await compare(
                    credentials.password,
                    admin.password
                );

                if (!isValid) {
                    throw new Error("Invalid credentials");
                }

                // Update last login
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
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as unknown as Record<string, unknown>).role as string;
                token.isPlatform = true;
            }
            return token;
        },
        async session({ session, token }) {
            return {
                ...session,
                user: {
                    ...session.user,
                    id: token.id as string,
                    role: token.role as string,
                    isPlatform: true,
                },
            };
        },
    },
};

// ============================================
// Platform Auth Context
// ============================================

export interface PlatformAuthContext {
    adminId: string;
    email: string;
    name: string;
    role: string;
    isPlatform: true;
}

/**
 * Get the current platform admin session.
 * Returns null if not authenticated as platform admin.
 */
export async function getPlatformSession(): Promise<PlatformAuthContext | null> {
    const session = await getServerSession(platformAuthOptions);

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

/**
 * Require platform admin authentication for API routes.
 * Returns PlatformAuthContext or NextResponse 401/403.
 */
export async function requirePlatformAuth(): Promise<
    PlatformAuthContext | NextResponse
> {
    const ctx = await getPlatformSession();

    if (!ctx) {
        return new NextResponse(
            JSON.stringify({
                error: "Platform authentication required",
                code: "PLATFORM_AUTH_REQUIRED",
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    return ctx;
}

/**
 * Type guard to check if result is PlatformAuthContext
 */
export function isPlatformAuthenticated(
    result: PlatformAuthContext | NextResponse
): result is PlatformAuthContext {
    return !(result instanceof NextResponse);
}

// ============================================
// Platform Audit Logging
// ============================================

/**
 * Log a platform admin action to the audit trail.
 * Every sensitive operation MUST call this.
 */
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
        // Audit log failure should NEVER break the operation
        // but MUST be reported
        console.error("[PLATFORM_AUDIT] Failed to log action:", error);
    }
}
