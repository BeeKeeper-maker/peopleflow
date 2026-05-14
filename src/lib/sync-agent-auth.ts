import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrgSubscription } from "@/lib/plan-enforcement";
import { canAccessModule } from "@/lib/module-entitlements";

export async function authenticateSyncAgent(req: Request) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return {
            valid: false as const,
            response: NextResponse.json(
                { success: false, error: "Missing authorization" },
                { status: 401 }
            ),
        };
    }

    const rawKey = authHeader.substring(7).trim();
    if (!rawKey.startsWith("pf_sync_")) {
        return {
            valid: false as const,
            response: NextResponse.json(
                { success: false, error: "Invalid or revoked API key" },
                { status: 401 }
            ),
        };
    }

    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await prisma.syncApiKey.findUnique({
        where: { key: keyHash },
        include: {
            organization: {
                select: { id: true, name: true, timezone: true, status: true },
            },
        },
    });

    if (!apiKey || !apiKey.isActive || apiKey.revokedAt) {
        return {
            valid: false as const,
            response: NextResponse.json(
                { success: false, error: "Invalid or revoked API key" },
                { status: 401 }
            ),
        };
    }

    if (apiKey.organization.status !== "active") {
        return {
            valid: false as const,
            response: NextResponse.json(
                { success: false, error: "Organization suspended" },
                { status: 403 }
            ),
        };
    }

    const subscription = await getOrgSubscription(apiKey.organizationId);
    if (!subscription || !["active", "trialing"].includes(subscription.status)) {
        return {
            valid: false as const,
            response: NextResponse.json(
                {
                    success: false,
                    error: "Subscription inactive",
                    upgradeRequired: true,
                },
                { status: 402 }
            ),
        };
    }

    if (!canAccessModule(subscription.features, "biometric")) {
        return {
            valid: false as const,
            response: NextResponse.json(
                {
                    success: false,
                    error: "Biometric device access is not included in this company package",
                    upgradeRequired: true,
                },
                { status: 403 }
            ),
        };
    }

    return { valid: true as const, apiKey };
}
