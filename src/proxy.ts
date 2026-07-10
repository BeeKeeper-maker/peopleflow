/**
 * PeopleFlow Proxy — Auth.js v5 request guard
 *
 * Imports from auth.config.ts (NO Prisma/Node.js APIs) to keep
 * request guarding lightweight. JWT decoding only — no DB access.
 *
 * P9-RATELIMIT-HEADERS: also runs a lightweight in-memory global
 * rate limit on /api/ routes that bypass the per-route Redis limiter.
 * See `edgeGlobalRateLimit` below for rationale and trade-offs.
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

// ── Edge-only global rate limiter (P9-RATELIMIT-HEADERS) ──────────────
//
// The middleware runs on the Edge Runtime, which cannot import
// `@/lib/rate-limit.ts` (that pulls in `ioredis` + `pino` — Node-only).
// As a SAFETY NET for routes without per-route rate limits, we keep an
// in-memory `Map` of IP -> {count, resetAt} per edge instance.
//
// Trade-offs:
//  • Per-instance, not per-cluster — a user rotating across instances
//    could exceed the cap by `N_instances × limit`. Per-route Redis
//    limits remain the primary protection for sensitive endpoints.
//  • Resets on cold start. Acceptable — this is a fallback, not the
//    main line of defense.
//  • 1000 req/min per IP is generous enough for legitimate SPA use
//    (a dashboard page makes ~5-10 API calls per navigation), but
//    catches scripted abuse on routes that forgot to add a per-route
//    limit (e.g. new endpoints added in a hurry).
//
// Skips:
//  • `/api/cron/*` — invoked by the scheduler with CRON_SECRET, no IP
//  • `/api/webhooks/*` — server-to-server, IP-whitelisted at handler
//  • `/api/health` — liveness probe, must always answer 200

interface EdgeRateBucket {
    count: number;
    resetAt: number; // epoch ms
}

const EDGE_RATE_LIMIT_MAX = 1000;       // 1000 requests…
const EDGE_RATE_LIMIT_WINDOW_MS = 60_000; // …per minute per IP
const EDGE_RATE_BUCKETS = new Map<string, EdgeRateBucket>();
// Sweep stale buckets every 5 minutes so the Map doesn't grow unbounded
// on a long-lived edge instance behind many distinct IPs.
let lastEdgeSweepAt = 0;

function getClientIpFromEdgeRequest(req: NextRequest): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp;
    return "127.0.0.1";
}

/**
 * In-memory IP rate limit for the edge middleware.
 *
 * Returns `null` when the request is allowed (the caller should continue
 * normal processing). Returns a `NextResponse` (429) when the IP has
 * exceeded the global edge limit — the caller should return that
 * response directly.
 */
function edgeGlobalRateLimit(req: NextRequest): NextResponse | null {
    const now = Date.now();

    // Periodic sweep of expired buckets (amortized O(1) per request).
    if (now - lastEdgeSweepAt > 5 * 60_000) {
        lastEdgeSweepAt = now;
        for (const [k, b] of EDGE_RATE_BUCKETS) {
            if (b.resetAt <= now) EDGE_RATE_BUCKETS.delete(k);
        }
    }

    const ip = getClientIpFromEdgeRequest(req);
    const bucket = EDGE_RATE_BUCKETS.get(ip);

    if (!bucket || bucket.resetAt <= now) {
        // Start a fresh window.
        EDGE_RATE_BUCKETS.set(ip, {
            count: 1,
            resetAt: now + EDGE_RATE_LIMIT_WINDOW_MS,
        });
        return null;
    }

    bucket.count += 1;
    if (bucket.count > EDGE_RATE_LIMIT_MAX) {
        const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
        const resetEpochSec = Math.ceil(bucket.resetAt / 1000);
        return NextResponse.json(
            {
                error: "Rate limit exceeded",
                message: `Too many requests. Please retry after ${retryAfterSec} seconds.`,
                retryAfter: retryAfterSec,
            },
            {
                status: 429,
                headers: {
                    "Retry-After": String(retryAfterSec),
                    "X-RateLimit-Limit": String(EDGE_RATE_LIMIT_MAX),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": String(resetEpochSec),
                },
            }
        );
    }

    return null;
}

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

    // ── P9-RATELIMIT-HEADERS: global edge rate limit for /api/ routes ──
    // Safety net for routes that don't have their own per-route rate limit.
    // Skips server-to-server paths (cron, webhooks) and the liveness probe.
    // See `edgeGlobalRateLimit` above for trade-offs.
    if (
        pathname.startsWith("/api/") &&
        !pathname.startsWith("/api/cron/") &&
        !pathname.startsWith("/api/webhooks/") &&
        !pathname.startsWith("/api/health")
    ) {
        const limited = edgeGlobalRateLimit(req);
        if (limited) return limited;
    }

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
