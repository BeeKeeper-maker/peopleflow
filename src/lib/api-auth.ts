/**
 * API Authentication Utilities
 * 
 * Centralized authentication for API routes
 * Industry-standard approach with:
 * - Type-safe session handling
 * - Consistent error responses
 * - Role-based access control foundation
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Standard error responses
export const AuthErrors = {
    UNAUTHORIZED: () => new NextResponse(
        JSON.stringify({ error: "Unauthorized", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
    ),
    FORBIDDEN: () => new NextResponse(
        JSON.stringify({ error: "Forbidden", code: "ACCESS_DENIED" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
    ),
    NO_ORGANIZATION: () => new NextResponse(
        JSON.stringify({ error: "Organization not found", code: "NO_ORG" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
    ),
    NO_EMPLOYEE: () => new NextResponse(
        JSON.stringify({ error: "Employee profile not found", code: "NO_EMPLOYEE" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
    ),
};

// User role type
export type UserRole = "super_admin" | "admin" | "hr_admin" | "manager" | "employee";

// Authenticated user context
export interface AuthContext {
    userId: string;
    email: string;
    role: UserRole;
    organizationId: string;
    employeeId?: string;
}

/**
 * Require authentication for API route
 * Returns AuthContext if authenticated, or NextResponse error
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return AuthErrors.UNAUTHORIZED();
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { employee: true },
        });

        if (!user) {
            return AuthErrors.UNAUTHORIZED();
        }

        if (!user.organizationId) {
            return AuthErrors.NO_ORGANIZATION();
        }

        return {
            userId: user.id,
            email: user.email!,
            role: user.role as UserRole,
            organizationId: user.organizationId,
            employeeId: user.employee?.id,
        };
    } catch (error) {
        console.error("AUTH_ERROR", error);
        return AuthErrors.UNAUTHORIZED();
    }
}

/**
 * Require authentication with employee profile
 */
export async function requireEmployee(): Promise<(AuthContext & { employeeId: string }) | NextResponse> {
    const auth = await requireAuth();

    if (auth instanceof NextResponse) {
        return auth;
    }

    if (!auth.employeeId) {
        return AuthErrors.NO_EMPLOYEE();
    }

    return auth as AuthContext & { employeeId: string };
}

/**
 * Require specific role(s) for API access
 */
export async function requireRole(
    allowedRoles: UserRole[]
): Promise<AuthContext | NextResponse> {
    const auth = await requireAuth();

    if (auth instanceof NextResponse) {
        return auth;
    }

    if (!allowedRoles.includes(auth.role)) {
        return AuthErrors.FORBIDDEN();
    }

    return auth;
}

/**
 * Require admin or HR role
 */
export async function requireAdminOrHR(): Promise<AuthContext | NextResponse> {
    return requireRole(["super_admin", "admin", "hr_admin"]);
}

/**
 * Require admin, HR, or manager role
 */
export async function requireManagerOrAbove(): Promise<AuthContext | NextResponse> {
    return requireRole(["super_admin", "admin", "hr_admin", "manager"]);
}

/**
 * Type guard to check if result is AuthContext (not error)
 */
export function isAuthenticated(result: AuthContext | NextResponse): result is AuthContext {
    return !(result instanceof NextResponse);
}
