/**
 * NextAuth Catch-all Route — Rate-Limited
 *
 * Wraps the default Auth.js handlers with brute-force protection
 * on the credentials login endpoint (POST /api/auth/callback/credentials).
 */

import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { authLogger } from "@/lib/logger";

const { GET, POST: OriginalPOST } = handlers;

/**
 * Rate-limited POST handler.
 * Auth.js uses POST for:
 *   - /api/auth/callback/credentials (login)
 *   - /api/auth/signout
 *   - /api/auth/csrf
 *
 * We only rate-limit the credentials callback to prevent brute-force.
 */
async function POST(request: NextRequest) {
    const url = new URL(request.url);

    // Rate limit credentials login attempts: 10 per 15 minutes per IP
    if (url.pathname.includes("/callback/credentials")) {
        const rl = await rateLimit(request, RATE_LIMIT_CONFIGS.auth, "auth/credentials/login");
        if (!rl.allowed) {
            authLogger.warn(
                { ip: request.headers.get("x-forwarded-for") || "unknown" },
                "Rate limit hit on credentials login"
            );
            return rl.response!;
        }
    }

    return OriginalPOST(request);
}

export { GET, POST };
