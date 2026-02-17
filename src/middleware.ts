import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

// Role type for type safety
type UserRole = "super_admin" | "admin" | "hr_admin" | "manager" | "employee";

// Default routes based on role
const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
    super_admin: "/dashboard",
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

// Check if user has HR level access
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
    return ROLE_DEFAULT_ROUTES[role as UserRole] || "/ess/dashboard";
}

export default withAuth(
    function middleware(req: NextRequestWithAuth) {
        const pathname = req.nextUrl.pathname;
        const token = req.nextauth.token;
        const role = token?.role as UserRole | undefined;

        // If authenticated and trying to access login/register
        if (token && (pathname === "/login" || pathname === "/register")) {
            const defaultRoute = getDefaultRoute(role);
            return NextResponse.redirect(new URL(defaultRoute, req.url));
        }

        // Root path - redirect to appropriate dashboard
        if (pathname === "/" && token) {
            const defaultRoute = getDefaultRoute(role);
            return NextResponse.redirect(new URL(defaultRoute, req.url));
        }

        // Check HR route access
        const isHRRoute = HR_ROUTES.some((route) => pathname.startsWith(route));
        if (isHRRoute && token && !isHRLevel(role)) {
            // Non-HR users trying to access HR routes
            const defaultRoute = getDefaultRoute(role);
            return NextResponse.redirect(new URL(defaultRoute, req.url));
        }

        // Check Manager route access
        if (pathname.startsWith("/manager") && token && !isManagerLevel(role)) {
            // Regular employees trying to access manager routes
            return NextResponse.redirect(new URL("/ess/dashboard", req.url));
        }

        // ESS routes - all authenticated users can access
        // No special check needed, withAuth handles authentication

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
                    "/careers", // Public career page
                ];

                // Allow public routes
                if (publicRoutes.some((route) => pathname.startsWith(route))) {
                    return true;
                }

                // API routes for auth should be public
                if (pathname.startsWith("/api/auth")) {
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
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder files
         * - api (API routes handle their own authentication)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)",
    ],
};

