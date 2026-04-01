import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

// Role type for type safety
type UserRole = "admin" | "hr_admin" | "manager" | "employee";

// Default routes based on role
const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
    admin: "/dashboard",
    hr_admin: "/dashboard",
    manager: "/manager/dashboard",
    employee: "/ess/dashboard",
};

// Routes HR/Admin can access
const HR_ROUTES = [
    "/dashboard",
    "/employees",
    "/departments",
    "/designations",
    "/leaves",
    "/attendance",
    "/payroll",
    "/recruitment",
    "/performance",
    "/reports",
    "/settings",
    "/notifications",
    "/shifts",
    "/organization",
    "/expenses",
    "/documents",
    "/audit-logs",
    "/compliance",
    "/announcements",
    "/loans",
    "/approval-workflows",
    "/devices",
];

// Check if user has HR level access (deprecated super_admin → treated as admin)
function isHRLevel(role?: string): boolean {
    return ["super_admin", "admin", "hr_admin"].includes(role || "");
}

// Check if user has Manager level access
function isManagerLevel(role?: string): boolean {
    return ["super_admin", "admin", "hr_admin", "manager"].includes(role || "");
}

// Get default route for role
function getDefaultRoute(role?: string): string {
    if (!role) return "/login";
    // Map deprecated super_admin to admin behavior
    if (role === "super_admin") return "/dashboard";
    return ROLE_DEFAULT_ROUTES[role as UserRole] || "/ess/dashboard";
}

export default withAuth(
    function middleware(req: NextRequestWithAuth) {
        const pathname = req.nextUrl.pathname;
        const token = req.nextauth.token;
        const role = token?.role as UserRole | undefined;

        // ─────────────────────────────────────────────
        // PLATFORM PLANE: /platform/* routes
        // Handled by separate auth system (platform-auth.ts)
        // This middleware allows them through — platform
        // auth is enforced at the API/page level
        // ─────────────────────────────────────────────
        if (pathname.startsWith("/platform")) {
            // Platform routes bypass tenant auth entirely
            return NextResponse.next();
        }

        // ─────────────────────────────────────────────
        // TENANT PLANE: Organization status check
        // If the org is suspended/deactivated, redirect
        // ─────────────────────────────────────────────
        // Note: We can't call async Redis/DB from edge middleware.
        // The org status check is enforced at the API layer via
        // api-auth.ts instead. The middleware handles client-side
        // routing only. See the /suspended page for the UX.

        // If authenticated and trying to access login/register
        if (token && (pathname === "/login" || pathname === "/register")) {
            const defaultRoute = getDefaultRoute(role as string);
            return NextResponse.redirect(new URL(defaultRoute, req.url));
        }

        // Root path - authenticated users go to dashboard, unauth see marketing page
        if (pathname === "/" && token) {
            const defaultRoute = getDefaultRoute(role as string);
            return NextResponse.redirect(new URL(defaultRoute, req.url));
        }

        // Check HR route access
        const isHRRoute = HR_ROUTES.some((route) => pathname.startsWith(route));
        if (isHRRoute && token && !isHRLevel(role as string)) {
            const defaultRoute = getDefaultRoute(role as string);
            return NextResponse.redirect(new URL(defaultRoute, req.url));
        }

        // Check Manager route access
        if (pathname.startsWith("/manager") && token && !isManagerLevel(role as string)) {
            return NextResponse.redirect(new URL("/ess/dashboard", req.url));
        }

        // Suspended page — always accessible (so suspended tenants can see it)
        if (pathname === "/suspended" || pathname === "/deactivated") {
            return NextResponse.next();
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                const pathname = req.nextUrl.pathname;

                // Public routes that don't require authentication
                const publicRoutes = [
                    "/login",
                    "/register",
                    "/forgot-password",
                    "/reset-password",
                    "/verify-email",
                    "/careers",
                    "/suspended",
                    "/deactivated",
                    "/platform/login",
                ];

                // Root path "/" is public (marketing landing page)
                if (pathname === "/") {
                    return true;
                }

                // Allow public routes
                if (publicRoutes.some((route) => pathname.startsWith(route))) {
                    return true;
                }

                // API routes for auth, webhooks, and health should be public
                if (
                    pathname.startsWith("/api/auth") ||
                    pathname.startsWith("/api/webhooks") ||
                    pathname.startsWith("/api/health")
                ) {
                    return true;
                }

                // Platform routes use their own auth system
                if (pathname.startsWith("/platform")) {
                    return true;
                }

                // All other routes require authentication
                return !!token;
            },
        },
        pages: {
            signIn: "/login",
        },
    }
);

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         * - api (API routes handle their own auth via api-auth.ts)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
    ],
};
