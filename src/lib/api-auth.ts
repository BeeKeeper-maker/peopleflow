/**
 * API Authentication — Auth.js v5 + RLS Integration
 *
 * Centralized authentication for API routes with:
 *   - Auth.js v5 `auth()` (replaces getServerSession)
 *   - RLS-scoped DB access via `withDB()`
 *   - Type-safe role-based access control
 */

import { auth } from "@/lib/auth";
import { prisma, withTenant, type TxClient } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authLogger } from "@/lib/logger";

// ── Error Responses ──────────────────────────────────────────────

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
    ORG_INACTIVE: (status: string) => new NextResponse(
        JSON.stringify({
            error: "Organization is not active",
            code: "ORG_INACTIVE",
            status,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
    ),
    NO_EMPLOYEE: () => new NextResponse(
        JSON.stringify({ error: "Employee profile not found", code: "NO_EMPLOYEE" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
    ),
};

// ── Types ────────────────────────────────────────────────────────

export type UserRole = "super_admin" | "admin" | "hr_admin" | "manager" | "employee";

export interface AuthContext {
    userId: string;
    email: string;
    role: UserRole;
    organizationId: string;
    employeeId?: string;
    /** Execute DB operations within RLS-enforced tenant scope */
    withDB: <T>(fn: (db: TxClient) => Promise<T>) => Promise<T>;
}

// ── Auth Functions ───────────────────────────────────────────────

export async function requireAuth(): Promise<AuthContext | NextResponse> {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return AuthErrors.UNAUTHORIZED();
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                employee: true,
                organization: { select: { status: true } },
            },
        });

        if (!user) {
            return AuthErrors.UNAUTHORIZED();
        }

        const sessionVersion = typeof session.user.sessionVersion === "number"
            ? session.user.sessionVersion
            : 0;

        if (sessionVersion !== user.sessionVersion) {
            return AuthErrors.UNAUTHORIZED();
        }

        if (!user.isActive || !user.emailVerified) {
            return AuthErrors.UNAUTHORIZED();
        }

        if (!user.organizationId) {
            return AuthErrors.NO_ORGANIZATION();
        }

        if (user.organization?.status !== "active") {
            return AuthErrors.ORG_INACTIVE(user.organization?.status || "missing");
        }

        const organizationId = user.organizationId;

        return {
            userId: user.id,
            email: user.email!,
            role: user.role as UserRole,
            organizationId,
            employeeId: user.employee?.id,
            withDB: <T>(fn: (db: TxClient) => Promise<T>) =>
                withTenant(organizationId, fn),
        };
    } catch (error) {
        authLogger.error({ err: error }, "Authentication error");
        return AuthErrors.UNAUTHORIZED();
    }
}

export async function requireEmployee(): Promise<(AuthContext & { employeeId: string }) | NextResponse> {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    if (!authResult.employeeId) return AuthErrors.NO_EMPLOYEE();

    const employee = await prisma.employee.findFirst({
        where: {
            id: authResult.employeeId,
            organizationId: authResult.organizationId,
            employmentStatus: "active",
            deletedAt: null,
        },
        select: { id: true },
    });

    if (!employee) return AuthErrors.FORBIDDEN();

    return authResult as AuthContext & { employeeId: string };
}

export async function requireRole(
    allowedRoles: UserRole[]
): Promise<AuthContext | NextResponse> {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    if (!allowedRoles.includes(authResult.role)) return AuthErrors.FORBIDDEN();
    return authResult;
}

export async function requireAdminOrHR(): Promise<AuthContext | NextResponse> {
    return requireRole(["super_admin", "admin", "hr_admin"]);
}

export async function requireManagerOrAbove(): Promise<AuthContext | NextResponse> {
    return requireRole(["super_admin", "admin", "hr_admin", "manager"]);
}

export function isAuthenticated(result: AuthContext | NextResponse): result is AuthContext {
    return !(result instanceof NextResponse);
}
