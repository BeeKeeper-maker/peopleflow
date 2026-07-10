/**
 * PeopleFlow Tenant Context Middleware
 *
 * Industry best practice for multi-tenant SaaS RLS:
 * Instead of converting 141 routes one-by-one to use withTenant(),
 * this module provides a higher-order function that wraps any API
 * route handler and automatically sets the tenant context.
 *
 * Usage:
 *   // Before (141 routes like this):
 *   export async function GET() {
 *       const auth = await requireAuth();
 *       if (!isAuthenticated(auth)) return auth;
 *       const data = await prisma.employee.findMany({
 *           where: { organizationId: auth.organizationId }
 *       });
 *       return NextResponse.json(data);
 *   }
 *
 *   // After (wrapped with tenant context):
 *   export const GET = withTenantContext(async (auth) => {
 *       const data = await prisma.employee.findMany({
 *           where: { organizationId: auth.organizationId }
 *       });
 *       return NextResponse.json(data);
 *   });
 *
 * The wrapper:
 *   1. Calls requireAuth() to get the AuthContext (with organizationId)
 *   2. Sets `app.current_tenant_id` for the database session
 *   3. Executes the route handler
 *   4. All Prisma queries within the handler are RLS-scoped
 *
 * This is a NON-BREAKING change:
 *   - Routes that already filter by organizationId continue to work
 *   - If a developer forgets to add organizationId, RLS catches it
 *   - The wrapper handles auth + tenant context in one call
 *
 * For routes that don't need auth (public routes, webhooks, cron):
 *   Don't wrap them — they use withPlatform() or no DB access.
 */

import { prisma, withTenant, type TxClient } from "@/lib/prisma";
import { requireAuth, isAuthenticated, type AuthContext, type UserRole } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { authLogger } from "@/lib/logger";

type RouteHandler = (
    req: Request,
    ctx: AuthContext,
    db: TxClient,
) => Promise<NextResponse | Response>;

interface WithTenantContextOptions {
    /** Allowed roles for this route (default: any authenticated user) */
    roles?: UserRole[];
    /** Require a specific permission (RBAC v2) */
    permission?: string;
}

/**
 * Wrap a GET route handler with automatic tenant context.
 *
 * The handler receives (req, auth, db) where:
 *   - req: the original Request
 *   - auth: AuthContext with userId, organizationId, role, employeeId
 *   - db: a Prisma transaction client with RLS tenant context set
 *
 * All queries through `db` are automatically scoped to the tenant.
 */
export function withTenantContext(
    handler: RouteHandler,
    options?: WithTenantContextOptions,
) {
    return async (req: Request): Promise<NextResponse | Response> => {
        // 1. Authenticate
        const authResult = await requireAuth();
        if (!isAuthenticated(authResult)) return authResult as NextResponse;

        const ctx = authResult as AuthContext;

        // 2. Role check (optional)
        if (options?.roles && !options.roles.includes(ctx.role)) {
            return NextResponse.json(
                { error: "Forbidden", code: "ACCESS_DENIED" },
                { status: 403 },
            );
        }

        // 3. Permission check (optional, RBAC v2)
        if (options?.permission) {
            const { hasEffectivePermission } = await import("@/lib/rbac-v2");
            const allowed = await hasEffectivePermission(
                ctx.userId,
                ctx.organizationId,
                options.permission,
            );
            if (!allowed) {
                return NextResponse.json(
                    { error: "Permission denied", code: "PERMISSION_DENIED", requiredPermission: options.permission },
                    { status: 403 },
                );
            }
        }

        // 4. Execute handler with tenant-scoped DB context
        try {
            return await withTenant(ctx.organizationId, (db) => handler(req, ctx, db));
        } catch (error) {
            authLogger.error({ err: error, userId: ctx.userId, path: req.url }, "Route handler error");
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    };
}

/**
 * Wrap a POST/PATCH/PUT/DELETE route handler with tenant context.
 * Same as withTenantContext but also passes the parsed body.
 */
export function withTenantContextBody<T = unknown>(
    handler: (
        req: Request,
        ctx: AuthContext,
        db: TxClient,
        body: T,
    ) => Promise<NextResponse | Response>,
    options?: WithTenantContextOptions,
) {
    return async (req: Request): Promise<NextResponse | Response> => {
        const authResult = await requireAuth();
        if (!isAuthenticated(authResult)) return authResult as NextResponse;

        const ctx = authResult as AuthContext;

        if (options?.roles && !options.roles.includes(ctx.role)) {
            return NextResponse.json(
                { error: "Forbidden", code: "ACCESS_DENIED" },
                { status: 403 },
            );
        }

        if (options?.permission) {
            const { hasEffectivePermission } = await import("@/lib/rbac-v2");
            const allowed = await hasEffectivePermission(
                ctx.userId,
                ctx.organizationId,
                options.permission,
            );
            if (!allowed) {
                return NextResponse.json(
                    { error: "Permission denied", code: "PERMISSION_DENIED" },
                    { status: 403 },
                );
            }
        }

        try {
            const body = await req.json().catch(() => ({}));
            return await withTenant(ctx.organizationId, (db) => handler(req, ctx, db, body as T));
        } catch (error) {
            authLogger.error({ err: error, userId: ctx.userId, path: req.url }, "Route handler error");
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    };
}

/**
 * Wrap a route handler that takes dynamic params (e.g., /api/employees/[id]).
 *
 * Usage:
 *   export const GET = withTenantContextParams(async (req, ctx, db, params) => {
 *       const { id } = await params;
 *       const employee = await db.employee.findFirst({ where: { id } });
 *       return NextResponse.json(employee);
 *   });
 */
export function withTenantContextParams(
    handler: (
        req: Request,
        ctx: AuthContext,
        db: TxClient,
        params: Record<string, string>,
    ) => Promise<NextResponse | Response>,
    options?: WithTenantContextOptions,
) {
    return async (req: Request, routeCtx: { params: Promise<Record<string, string>> }): Promise<NextResponse | Response> => {
        const authResult = await requireAuth();
        if (!isAuthenticated(authResult)) return authResult as NextResponse;

        const ctx = authResult as AuthContext;

        if (options?.roles && !options.roles.includes(ctx.role)) {
            return NextResponse.json(
                { error: "Forbidden", code: "ACCESS_DENIED" },
                { status: 403 },
            );
        }

        if (options?.permission) {
            const { hasEffectivePermission } = await import("@/lib/rbac-v2");
            const allowed = await hasEffectivePermission(
                ctx.userId,
                ctx.organizationId,
                options.permission,
            );
            if (!allowed) {
                return NextResponse.json(
                    { error: "Permission denied", code: "PERMISSION_DENIED" },
                    { status: 403 },
                );
            }
        }

        try {
            const params = await routeCtx.params;
            return await withTenant(ctx.organizationId, (db) => handler(req, ctx, db, params));
        } catch (error) {
            authLogger.error({ err: error, userId: ctx.userId, path: req.url }, "Route handler error");
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 },
            );
        }
    };
}

// Re-export prisma for routes that still use it directly (backward compat)
export { prisma };
