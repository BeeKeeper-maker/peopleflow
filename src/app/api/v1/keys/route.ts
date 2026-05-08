/**
 * External API v1: API Key Management
 *
 * POST /api/v1/keys — Generate a new API key
 * GET /api/v1/keys — List active API keys
 * DELETE /api/v1/keys — Revoke an API key
 *
 * Authenticated via tenant session (admin only).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { generateApiKey, hashApiKey } from "@/lib/api-key-auth";
import { apiLogger } from "@/lib/logger";
import { getOrgSubscription } from "@/lib/plan-enforcement";

export async function POST(request: NextRequest) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { name, type = "read_only", expiresInDays } = await request.json();
        if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

        const sub = await getOrgSubscription(auth.organizationId);
        if (!sub || !["active", "trialing"].includes(sub.status)) {
            return NextResponse.json({ error: "Subscription inactive", upgrade_required: true }, { status: 402 });
        }
        if (sub.features.apiAccess === false) {
            return NextResponse.json({ error: "API access not on your plan", upgrade_required: true }, { status: 402 });
        }

        // Map type to permissions array
        const permissionsMap: Record<string, string[]> = {
            full: ["*"],
            read_only: ["employees:read", "leaves:read", "attendance:read", "organization:read"],
            webhook: ["webhooks:send"],
        };
        const permissions = permissionsMap[type] || permissionsMap["read_only"];

        const rawKey = generateApiKey("live");
        const keyHash = hashApiKey(rawKey);
        const keyPrefix = rawKey.substring(0, 12) + "...";
        const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

        const apiKey = await prisma.apiKey.create({
            data: {
                name,
                keyHash,
                keyPrefix,
                permissions,
                expiresAt,
                organizationId: auth.organizationId,
            },
        });

        return NextResponse.json({
            success: true,
            apiKey: {
                id: apiKey.id,
                name: apiKey.name,
                prefix: apiKey.keyPrefix,
                permissions: apiKey.permissions,
                expiresAt: apiKey.expiresAt,
            },
            secretKey: rawKey,
            warning: "Save this key securely. It cannot be retrieved again.",
        }, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "[API_KEYS] Error:");
        return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
    }
}

export async function GET() {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    const keys = await prisma.apiKey.findMany({
        where: { organizationId: auth.organizationId, isActive: true },
        select: {
            id: true,
            name: true,
            keyPrefix: true,
            permissions: true,
            expiresAt: true,
            lastUsedAt: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ keys });
}

export async function DELETE(request: NextRequest) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    const { keyId } = await request.json();
    if (!keyId) return NextResponse.json({ error: "keyId required" }, { status: 400 });

    const key = await prisma.apiKey.findFirst({ where: { id: keyId, organizationId: auth.organizationId } });
    if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

    await prisma.apiKey.update({ where: { id: keyId }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: `Key '${key.name}' revoked` });
}
