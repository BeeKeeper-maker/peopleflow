/**
 * External API v1 — ApiKey Authentication Middleware
 *
 * Validates API keys for third-party integrations.
 * API keys are scoped to an organization and have permission levels.
 *
 * Usage:
 *   const auth = await authenticateApiKey(request);
 *   if (!auth.valid) return auth.response;
 *   // auth.organizationId, auth.keyId, auth.permissions available
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";
import { buildSubscriptionAccessError, getOrgSubscription } from "@/lib/plan-enforcement";
import { canAccessModule } from "@/lib/module-entitlements";

export interface ApiKeyAuthResult {
    valid: true;
    organizationId: string;
    keyId: string;
    keyName: string;
    permissions: string[];
}

export interface ApiKeyAuthError {
    valid: false;
    response: NextResponse;
}

export type ApiKeyAuth = ApiKeyAuthResult | ApiKeyAuthError;

/**
 * Hash an API key for storage comparison.
 * We store hashed keys, never plaintext.
 */
export function hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key with prefix for identification.
 * Format: pf_live_<random32chars> or pf_test_<random32chars>
 */
export function generateApiKey(
    mode: "live" | "test" = "live"
): string {
    const random = randomBytes(24).toString("base64url");
    return `pf_${mode}_${random}`;
}

/**
 * Authenticate an incoming request via API key.
 * Accepts key in Authorization header (Bearer) or X-API-Key header.
 */
export async function authenticateApiKey(
    request: NextRequest
): Promise<ApiKeyAuth> {
    // Extract API key from headers
    const authHeader = request.headers.get("authorization");
    const apiKeyHeader = request.headers.get("x-api-key");

    let rawKey: string | null = null;

    if (authHeader?.startsWith("Bearer pf_")) {
        rawKey = authHeader.replace("Bearer ", "").trim();
    } else if (apiKeyHeader) {
        rawKey = apiKeyHeader.trim();
    }

    if (!rawKey) {
        return {
            valid: false,
            response: NextResponse.json(
                {
                    error: "Authentication required",
                    message:
                        "Provide API key via Authorization: Bearer <key> or X-API-Key header",
                    docs: "/api/v1/docs",
                },
                { status: 401 }
            ),
        };
    }

    // Hash and look up
    const keyHash = hashApiKey(rawKey);

    const apiKey = await prisma.apiKey.findFirst({
        where: {
            keyHash,
            isActive: true,
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
        },
        include: {
            organization: {
                select: { id: true, status: true, name: true },
            },
        },
    });

    if (!apiKey) {
        return {
            valid: false,
            response: NextResponse.json(
                {
                    error: "Invalid API key",
                    message:
                        "The API key is invalid, expired, or has been revoked",
                },
                { status: 401 }
            ),
        };
    }

    // Check if the organization is active
    if (apiKey.organization.status !== "active") {
        return {
            valid: false,
            response: NextResponse.json(
                {
                    error: "Organization suspended",
                    message:
                        "Your organization's account has been suspended. Contact support.",
                },
                { status: 403 }
            ),
        };
    }

    const subscription = await getOrgSubscription(apiKey.organizationId);
    if (!subscription || !["active", "trialing"].includes(subscription.status)) {
        const accessError = buildSubscriptionAccessError(subscription);
        return {
            valid: false,
            response: NextResponse.json(
                {
                    error: accessError.title || "Company package inactive",
                    message: accessError.message,
                    code: accessError.code,
                    action: accessError.action,
                    upgrade_required: true,
                },
                { status: 402 }
            ),
        };
    }

    if (!canAccessModule(subscription.features, "apiAccess")) {
        return {
            valid: false,
            response: NextResponse.json(
                {
                    error: "API access not included",
                    message: "API access is not included in this company package. Please contact platform support if this company needs API access.",
                    code: "API_ACCESS_NOT_INCLUDED",
                    action: "Contact platform support",
                    upgrade_required: true,
                },
                { status: 402 }
            ),
        };
    }

    // Update last used timestamp (fire-and-forget)
    prisma.apiKey
        .update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() },
        })
        .catch(() => {}); // Non-blocking

    // Read permissions directly from the key's Json field
    const rawPermissions = apiKey.permissions;
    const permissions: string[] = Array.isArray(rawPermissions)
        ? (rawPermissions as string[])
        : ["employees:read"];

    return {
        valid: true,
        organizationId: apiKey.organizationId,
        keyId: apiKey.id,
        keyName: apiKey.name,
        permissions,
    };
}

/**
 * Check if an authenticated key has a specific permission.
 */
export function hasPermission(
    auth: ApiKeyAuthResult,
    permission: string
): boolean {
    return (
        auth.permissions.includes("*") ||
        auth.permissions.includes(permission)
    );
}

/**
 * Rate limit API key requests.
 * Returns headers to include in response.
 */
export function getApiRateLimitHeaders(
    remaining: number,
    limit: number,
    resetAt: number
): Record<string, string> {
    return {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": resetAt.toString(),
    };
}
