import { NextResponse } from "next/server";
import { withTenant } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";
import { authenticateSyncAgent } from "@/lib/sync-agent-auth";

/**
 * POST /api/v1/sync/heartbeat — Agent Health Check
 *
 * Called by the sync agent every interval to signal liveness.
 * Updates the API key's lastHeartbeat, agentVersion, and agentIp.
 *
 * Body: { agentVersion?: string, deviceIp?: string, uptime?: number }
 */
export async function POST(req: Request) {
    try {
        const auth = await authenticateSyncAgent(req);
        if (!auth.valid) return auth.response;
        const { apiKey } = auth;

        const body = await req.json().catch(() => ({}));

        const agentIp =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            "unknown";

        const heartbeatAt = new Date();
        const deviceIp = typeof body.deviceIp === "string" ? body.deviceIp.trim() : null;
        const devicePort = Number(body.devicePort) || 4370;

        // Wrap all DB writes in a single withTenant so RLS allows them in
        // production (peopleflow_app is NOSUPERUSER; raw prisma is blocked).
        // apiKey.organizationId is known from the authenticated API key.
        await withTenant(apiKey.organizationId, async (db) => {
            await db.syncApiKey.update({
                where: { id: apiKey.id },
                data: {
                    lastHeartbeat: heartbeatAt,
                    agentIp,
                    agentVersion: body.agentVersion || undefined,
                },
            });

            if (deviceIp) {
                await db.biometricDevice.updateMany({
                    where: {
                        organizationId: apiKey.organizationId,
                        ip: deviceIp,
                        port: devicePort,
                    },
                    data: {
                        isOnline: true,
                        lastPingAt: heartbeatAt,
                        consecutiveFailures: 0,
                    },
                });
            }
        });

        return NextResponse.json({
            success: true,
            message: "Heartbeat received",
            serverTime: new Date().toISOString(),
            organization: apiKey.organization.name,
            agentName: apiKey.name,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "HEARTBEAT_ERROR");
        return NextResponse.json(
            { success: false, error: "Internal error" },
            { status: 500 }
        );
    }
}
