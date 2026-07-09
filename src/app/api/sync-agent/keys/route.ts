import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { randomBytes, createHash } from "crypto";
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/sync-agent/keys — Generate a new Sync API Key
 * GET  /api/sync-agent/keys — List all keys for the organization
 *
 * Keys are stored as SHA-256 hashes. The raw key is returned ONLY on creation.
 */

function generateSyncKey(): { raw: string; hash: string; prefix: string } {
    const raw = `pf_sync_${randomBytes(32).toString("hex")}`;
    const hash = createHash("sha256").update(raw).digest("hex");
    const prefix = raw.substring(0, 16);
    return { raw, hash, prefix };
}

export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const body = await req.json();
        const name = body.name || "Default Sync Agent";

        const { raw, hash, prefix } = generateSyncKey();

        const apiKey = await auth.withDB((db) =>
            db.syncApiKey.create({
                data: {
                    key: hash,
                    keyPrefix: prefix,
                    name,
                    organizationId: auth.organizationId,
                },
                select: {
                    id: true,
                    keyPrefix: true,
                    name: true,
                    isActive: true,
                    createdAt: true,
                },
            }),
        );

        // Return the raw key ONLY on creation — it cannot be retrieved later
        return NextResponse.json({
            success: true,
            apiKey: {
                ...apiKey,
                rawKey: raw, // ⚠️ Single-use display — store this now!
            },
        });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "CREATE_SYNC_KEY_ERROR");
        return NextResponse.json(
            { error: "Failed to create API key", errorId },
            { status: 500 }
        );
    }
}

export async function GET() {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const keys = await auth.withDB((db) =>
            db.syncApiKey.findMany({
                where: {
                    organizationId: auth.organizationId,
                    revokedAt: null,
                },
                select: {
                    id: true,
                    keyPrefix: true,
                    name: true,
                    isActive: true,
                    lastHeartbeat: true,
                    lastSyncAt: true,
                    agentVersion: true,
                    agentIp: true,
                    syncCount: true,
                    totalRecords: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
            }),
        );

        return NextResponse.json({ success: true, keys });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "LIST_SYNC_KEYS_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
