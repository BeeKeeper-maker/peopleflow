import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSubscriptionAccessError, getOrgSubscription } from "@/lib/plan-enforcement";
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
        const accessError = buildSubscriptionAccessError(subscription);
        return {
            valid: false as const,
            response: NextResponse.json(
                {
                    success: false,
                    error: accessError.message,
                    code: accessError.code,
                    title: accessError.title,
                    action: accessError.action,
                    upgradeRequired: accessError.upgradeRequired,
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
                    error: "Biometric device sync is not included in this company package. Please contact platform support if this company needs device sync access.",
                    code: "BIOMETRIC_MODULE_NOT_INCLUDED",
                    title: "Device sync not included",
                    action: "Contact platform support",
                    upgradeRequired: true,
                },
                { status: 403 }
            ),
        };
    }

    return { valid: true as const, apiKey };
}
