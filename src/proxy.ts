/**
 * PeopleFlow Proxy — Auth.js v5 request guard
 *
 * Imports from auth.config.ts (NO Prisma/Node.js APIs) to keep
 * request guarding lightweight. JWT decoding only — no DB access.
 */

import NextAuth from "next-auth";
import type { NextAuthRequest } from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

// ── Role types and route definitions ─────────────────────────────

type UserRole = "super_admin" | "admin" | "hr_admin" | "manager" | "employee";

const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
    super_admin: "/dashboard",
    admin: "/dashboard",
    hr_admin: "/dashboard",
    manager: "/manager/dashboard",
    employee: "/ess/dashboard",
};

const HR_ROUTES = [
    "/dashboard", "/employees", "/departments", "/designations",
    "/leaves", "/attendance", "/payroll", "/recruitment",
    "/performance", "/reports", "/settings", "/notifications",
    "/shifts", "/organization", "/expenses", "/documents",
    "/audit-logs", "/compliance", "/announcements", "/loans",
    "/approval-workflows", "/devices",
];

const PUBLIC_ROUTES = [
    "/login", "/register", "/forgot-password", "/reset-password", "/set-password",
    "/verify-email", "/careers", "/suspended", "/deactivated",
    "/platform/login", "/legal",
];

const PUBLIC_API_ROUTES = [
    "/api/auth",
    "/api/webhooks",
    "/api/health",
    "/api/cron",
    "/api/leads",
    "/api/platform",
    // External API routes use bearer/API-key authentication inside route handlers.
    "/api/v1",
];

function isHRLevel(role?: string): boolean {
    return ["super_admin", "admin", "hr_admin"].includes(role || "");
}

function isManagerLevel(role?: string): boolean {
    return ["super_admin", "admin", "hr_admin", "manager"].includes(role || "");
}

function getDefaultRoute(role?: string): string {
    if (!role) return "/login";
    return ROLE_DEFAULT_ROUTES[role as UserRole] || "/ess/dashboard";
}

// ── Create request-guard auth instance from base config ──────────────

const { auth } = NextAuth(authConfig);

// ── Auth.js v5 Proxy ─────────────────────────────────────────────

export default auth((req: NextAuthRequest) => {
    const pathname = req.nextUrl.pathname;
    const session = req.auth;
    const role = session?.user?.role as UserRole | undefined;

    // Platform routes — handled by separate auth system
    if (pathname.startsWith("/platform")) {
        return NextResponse.next();
    }

    // Public routes — accessible without a session; logged-in users should not remain on login/register.
    if (pathname === "/" && !session) return NextResponse.next();
    if ((pathname === "/login" || pathname === "/register") && session) {
        return NextResponse.redirect(new URL(getDefaultRoute(role), req.url));
    }
    if (PUBLIC_ROUTES.some((route: string) => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // API routes for auth, webhooks, health, leads, cron, platform — route handlers secure these.
    if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // API clients should receive JSON status codes, never HTML login redirects.
    if (pathname.startsWith("/api") && !session) {
        return NextResponse.json(
            { error: "Unauthorized", code: "AUTH_REQUIRED" },
            { status: 401 }
        );
    }

    // Unauthenticated users → login
    if (!session) {
        return NextResponse.redirect(new URL("/login", req.url));
    }


    // Root path → role-based dashboard
    if (pathname === "/") {
        return NextResponse.redirect(new URL(getDefaultRoute(role), req.url));
    }

    // HR route access check
    const isHRRoute = HR_ROUTES.some((route) => pathname.startsWith(route));
    if (isHRRoute && !isHRLevel(role)) {
        return NextResponse.redirect(new URL(getDefaultRoute(role), req.url));
    }

    // Manager route access check
    if (pathname.startsWith("/manager") && !isManagerLevel(role)) {
        return NextResponse.redirect(new URL("/ess/dashboard", req.url));
    }

    // Suspended/deactivated pages — always accessible
    if (pathname === "/suspended" || pathname === "/deactivated") {
        return NextResponse.next();
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|webmanifest|html|txt|xml)$).*)",
    ],
};
