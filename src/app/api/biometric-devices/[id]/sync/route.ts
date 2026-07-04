import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { enqueueSyncDevice } from "@/workers/biometric-sync";
import { syncDevice } from "@/lib/biometric/sync-engine";
import { biometricLogger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/biometric-devices/[id]/sync — Trigger manual sync
 *
 * Behavior:
 *   - For sync_agent devices: Returns immediately with a helpful message.
 *     The actual data arrives via the Sync Agent's periodic push.
 *     We do NOT enqueue a cloud-pull job because the cloud cannot reach
 *     a private-LAN device.
 *
 *   - For direct_cloud devices: Enqueues a BullMQ sync job and returns
 *     202 Accepted with the job ID. The caller can poll the device's
 *     lastSyncAt / lastSyncStatus to see progress. This avoids the old
 *     behavior of running sync inline (which could exceed request
 *     timeouts for slow devices).
 *
 *     If the queue is unavailable (e.g. Redis down), we fall back to
 *     running the sync inline so the dashboard button still works.
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id } = await params;

        // Verify device belongs to org
        const device = await auth.withDB((db) => db.biometricDevice.findFirst({
            where: { id, organizationId: auth.organizationId },
            select: {
                id: true,
                name: true,
                connectionMode: true,
                lastSyncAt: true,
                lastSyncStatus: true,
                syncInterval: true,
                syncApiKey: {
                    select: {
                        id: true,
                        lastHeartbeat: true,
                        lastSyncAt: true,
                        agentVersion: true,
                    },
                },
            },
        }));

        if (!device) {
            return new NextResponse("Device not found", { status: 404 });
        }

        // ── sync_agent: data arrives via agent push, not cloud pull ──
        if (device.connectionMode === "sync_agent") {
            const heartbeat =
                device.syncApiKey?.lastHeartbeat ||
                device.syncApiKey?.lastSyncAt ||
                device.lastSyncAt;
            const ageMin = heartbeat
                ? Math.round((Date.now() - heartbeat.getTime()) / 60000)
                : null;
            const staleAfterMin = Math.max(3 * device.syncInterval, 15);

            return NextResponse.json({
                success: true,
                mode: "sync_agent",
                message:
                    ageMin === null
                        ? "This device is managed by a PeopleFlow Sync Agent. Install and start the agent on the office PC to begin syncing attendance data."
                        : ageMin > staleAfterMin
                          ? `Sync Agent has not pushed data in ${ageMin} minutes. Check that the PeopleFlow Sync Agent is running on the office PC.`
                          : `Sync Agent is healthy — last push ${ageMin} minutes ago. New attendance data will arrive automatically on the next agent cycle.`,
                deviceId: device.id,
                deviceName: device.name,
                lastSyncAt: device.lastSyncAt,
                lastSyncStatus: device.lastSyncStatus,
                agentHeartbeatAgeMinutes: ageMin,
                recordsSynced: 0,
                recordsSkipped: 0,
                duration: 0,
                retriable: false,
            });
        }

        // ── direct_cloud: enqueue BullMQ job ──
        try {
            await enqueueSyncDevice(id);
            return NextResponse.json(
                {
                    success: true,
                    mode: "direct_cloud",
                    message: "Sync queued. The device card will update when the job completes.",
                    deviceId: device.id,
                    deviceName: device.name,
                    queued: true,
                },
                { status: 202 },
            );
        } catch (queueError) {
            // Queue unavailable (Redis down) — fall back to inline sync
            biometricLogger.warn(
                { err: queueError, deviceId: id },
                "BullMQ enqueue failed; falling back to inline sync",
            );
            const result = await syncDevice(id);
            return NextResponse.json(result);
        }
    } catch (error) {
        biometricLogger.error({ err: error }, "SYNC_DEVICE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
