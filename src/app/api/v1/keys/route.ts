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
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey, hashApiKey } from "@/lib/api-key-auth";

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user?.organizationId || !["admin", "super_admin"].includes(user.role)) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    try {
        const { name, type = "read_only", expiresInDays } = await request.json();
        if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

        const sub = await prisma.subscription.findUnique({
            where: { organizationId: user.organizationId },
            include: { plan: true },
        });
        const features = (sub?.plan?.features || {}) as Record<string, boolean>;
        if (features.apiAccess === false) {
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
                organizationId: user.organizationId,
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
        console.error("[API_KEYS] Error:", error);
        return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
    }
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user?.organizationId) return NextResponse.json({ error: "No org" }, { status: 400 });

    const keys = await prisma.apiKey.findMany({
        where: { organizationId: user.organizationId, isActive: true },
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user?.organizationId || !["admin", "super_admin"].includes(user.role)) {
        return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    const { keyId } = await request.json();
    if (!keyId) return NextResponse.json({ error: "keyId required" }, { status: 400 });

    const key = await prisma.apiKey.findFirst({ where: { id: keyId, organizationId: user.organizationId } });
    if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

    await prisma.apiKey.update({ where: { id: keyId }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: `Key '${key.name}' revoked` });
}
