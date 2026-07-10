/**
 * Cron Authentication Guard
 *
 * Secures all /api/cron/* endpoints with a Bearer token check.
 * The CRON_SECRET env var must match the Authorization header.
 *
 * Usage patterns:
 * 1. Coolify/external scheduler → HTTP GET with Bearer header
 * 2. Vercel Cron → CRON_SECRET in vercel.json
 * 3. curl/manual trigger → curl -H "Authorization: Bearer $CRON_SECRET" ...
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { cronLogger } from "@/lib/logger";

/**
 * Validate cron request authentication.
 * Returns null if authenticated, or an error NextResponse if not.
 *
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyCronAuth(req: Request): NextResponse | null {
    const secret = process.env.CRON_SECRET;

    // If no CRON_SECRET is set, default to DENY. Only allow without secret
    // when ALLOW_INSECURE_CRON=1 is explicitly set (e.g. local development).
    // This prevents accidental exposure if NODE_ENV is "development" in a
    // staging/preview environment that's reachable from the internet.
    if (!secret) {
        if (process.env.ALLOW_INSECURE_CRON !== "1") {
            cronLogger.fatal("CRON_SECRET is not set! Set ALLOW_INSECURE_CRON=1 to allow in development.");
            return NextResponse.json(
                { error: "Cron endpoint not configured" },
                { status: 503 }
            );
        }
        // Explicit opt-in: allow without secret (development only)
        cronLogger.warn("Running without CRON_SECRET (ALLOW_INSECURE_CRON=1)");
        return null;
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: "Missing authorization header" },
            { status: 401 }
        );
    }

    const token = authHeader.substring(7);

    // Constant-time comparison to prevent timing attacks
    // (P0-7 from infra audit: previously used !== which leaks secret length)
    try {
        const secretBuf = Buffer.from(secret);
        const tokenBuf = Buffer.from(token);

        // Buffers must be same length for timingSafeEqual
        if (secretBuf.length !== tokenBuf.length) {
            return NextResponse.json(
                { error: "Invalid cron secret" },
                { status: 403 }
            );
        }

        if (!timingSafeEqual(secretBuf, tokenBuf)) {
            return NextResponse.json(
                { error: "Invalid cron secret" },
                { status: 403 }
            );
        }
    } catch {
        return NextResponse.json(
            { error: "Invalid cron secret" },
            { status: 403 }
        );
    }

    return null; // Authenticated
}

/**
 * Create a standardized cron response with execution metadata.
 */
export function cronResponse(
    data: Record<string, unknown>,
    status: "success" | "partial" | "error" = "success"
) {
    return NextResponse.json({
        status,
        ...data,
        executedAt: new Date().toISOString(),
        runtime: `${process.env.NODE_ENV || "development"}`,
    });
}
