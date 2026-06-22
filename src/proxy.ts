/**
 * PeopleFlow Proxy — Auth.js v5 request guard
 *
 * Imports from auth.config.ts (NO Prisma/Node.js APIs) to keep
 * request guarding lightweight. JWT decoding only — no DB access.
 */

import NextAuth from "next-auth";
import type { NextAuthRequest } from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextRequest, NextResponse } from "next/server";
import { canAccessPath, type EntitlementFeatures } from "@/lib/module-entitlements";

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
    "/platform/login", "/auth/impersonate", "/legal",
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

const PUBLIC_MACHINE_ROUTES = [
    // ZKTeco ADMS/iClock devices are not browser users; route handlers perform
    // tenant/serial registration and unknown-device capture safely.
    "/iclock",
];


function denyModuleAccess(pathname: string, req: NextAuthRequest, kind: "page" | "api", features?: EntitlementFeatures) {
    const access = canAccessPath(features, pathname, kind);
    if (access.allowed) return null;

    if (kind === "api") {
        return NextResponse.json(
            {
                error: `${access.matchedModule.label} is not included in this company package.`,
                code: "MODULE_NOT_INCLUDED",
                module: access.matchedModule.key,
                upgradeRequired: true,
            },
            { status: 403 }
        );
    }

    const url = new URL("/billing/upgrade", req.url);
    url.searchParams.set("source", "module-disabled");
    url.searchParams.set("module", access.matchedModule.key);
    return NextResponse.redirect(url);
}

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

function isPublicPath(pathname: string): boolean {
    return (
        pathname === "/" ||
        pathname.startsWith("/platform") ||
        PUBLIC_ROUTES.some((route: string) => pathname.startsWith(route)) ||
        PUBLIC_MACHINE_ROUTES.some((route) => pathname.startsWith(route)) ||
        PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))
    );
}

const protectedProxy = auth((req: NextAuthRequest) => {
    const pathname = req.nextUrl.pathname;
    const session = req.auth;
    const role = session?.user?.role as UserRole | undefined;
    const features = session?.user?.features as EntitlementFeatures | undefined;

    // API clients should receive JSON status codes, never HTML login redirects.
    if (pathname.startsWith("/api") && !session) {
        return NextResponse.json(
            { error: "Unauthorized", code: "AUTH_REQUIRED" },
            { status: 401 }
        );
    }

    if (pathname.startsWith("/api") && session) {
        const denied = denyModuleAccess(pathname, req, "api", features);
        if (denied) return denied;
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

    const denied = denyModuleAccess(pathname, req, "page", features);
    if (denied) return denied;

    return NextResponse.next();
});

export default function proxy(
    req: NextRequest,
    context: { params: Promise<Record<string, string | string[]>> }
) {
    const pathname = req.nextUrl.pathname;

    // Public pages/APIs should not invoke Auth.js. Invoking Auth.js here creates
    // CSRF/callback cookies and forces private no-store responses, which makes
    // the marketing and login pages slow on every request.
    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    return protectedProxy(req as unknown as NextAuthRequest, context);
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|webmanifest|html|txt|xml)$).*)",
    ],
};
