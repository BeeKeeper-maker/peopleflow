/**
 * Platform Token Verification — Shared JWT helper
 *
 * Used by all /api/platform/* routes to validate the custom JWT
 * stored in the `pf-platform-token` cookie.
 *
 * This is separate from Auth.js — the platform admin login system
 * uses its own JWT issued by POST /api/platform/auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const PLATFORM_JWT_SECRET = (() => {
    const secret = process.env.PLATFORM_JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
        const msg = [
            "",
            "╔══════════════════════════════════════════════════════════════╗",
            "║  FATAL: No JWT secret configured for Platform Admin auth   ║",
            "╚══════════════════════════════════════════════════════════════╝",
            "",
            "  Set PLATFORM_JWT_SECRET or NEXTAUTH_SECRET in your environment.",
            "  Without this, platform admin tokens cannot be verified securely.",
            "",
        ].join("\n");
        // In production, crash immediately. In dev, log a loud warning.
        if (process.env.NODE_ENV === "production") {
            throw new Error(msg);
        }
        console.error(msg);
        // Return a runtime-only dev fallback that is NOT a static string
        return `dev-only-${Date.now()}-${Math.random().toString(36)}`;
    }
    return secret;
})();

export interface PlatformTokenPayload {
    id: string;
    email: string;
    name: string;
    role: string;
    isPlatform: true;
}

/**
 * Verify the platform admin JWT from cookie or Authorization header.
 * Returns the admin profile or a 401 NextResponse.
 */
export async function verifyPlatformRequest(
    request: NextRequest
): Promise<{ admin: PlatformTokenPayload } | NextResponse> {
    const token =
        request.cookies.get("pf-platform-token")?.value ||
        request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
        return NextResponse.json(
            { error: "Not authenticated" },
            { status: 401 }
        );
    }

    try {
        const decoded = verify(token, PLATFORM_JWT_SECRET) as PlatformTokenPayload;

        if (!decoded.isPlatform) {
            return NextResponse.json(
                { error: "Invalid token type" },
                { status: 401 }
            );
        }

        // Verify admin still exists and is active
        const admin = await prisma.platformAdmin.findUnique({
            where: { id: decoded.id },
            select: { id: true, isActive: true },
        });

        if (!admin || !admin.isActive) {
            return NextResponse.json(
                { error: "Account not found or disabled" },
                { status: 401 }
            );
        }

        return { admin: decoded };
    } catch {
        return NextResponse.json(
            { error: "Invalid or expired token" },
            { status: 401 }
        );
    }
}

/**
 * Type guard: check if verification succeeded
 */
export function isPlatformVerified(
    result: { admin: PlatformTokenPayload } | NextResponse
): result is { admin: PlatformTokenPayload } {
    return !(result instanceof NextResponse);
}

/**
 * Verify platform admin from cookies (for Server Actions / Server Components).
 * Uses next/headers to read the cookie — no NextRequest needed.
 */
export async function verifyPlatformCookie(): Promise<PlatformTokenPayload | null> {
    // Dynamic import to avoid issues in API routes
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("pf-platform-token")?.value;

    if (!token) return null;

    try {
        const decoded = verify(token, PLATFORM_JWT_SECRET) as PlatformTokenPayload;
        if (!decoded.isPlatform) return null;

        const admin = await prisma.platformAdmin.findUnique({
            where: { id: decoded.id },
            select: { id: true, isActive: true },
        });

        if (!admin || !admin.isActive) return null;
        return decoded;
    } catch {
        return null;
    }
}

/** Exported for the auth login route */
export { PLATFORM_JWT_SECRET };
