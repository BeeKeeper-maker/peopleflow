import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";
import { authenticateSyncAgent } from "@/lib/sync-agent-auth";
import { ingestBiometricPunches, type BiometricPunchRecord } from "@/lib/biometric/punch-processor";

/**
 * POST /api/v1/sync/push — Cloud Ingest Endpoint
 *
 * Receives attendance punch data from the PeopleFlow Sync Agent.
 * Authenticated via Bearer token (SyncApiKey).
 *
 * Body: {
 *   deviceSerial?: string,
 *   deviceIp?: string,
 *   devicePort?: number,
 *   agentVersion?: string,
 *   records: [{ userId: string, timestamp: string, type?: number }]
 * }
 *
 * The engine:
 *   1. Validates API key (authenticateSyncAgent)
 *   2. Delegates punch processing to the canonical punch-processor
 *      (shared with ADMS/iClock path — single source of truth)
 *   3. Updates SyncApiKey stats
 *   4. Updates matching BiometricDevice card (if deviceIp matches a device row)
 *   5. Returns summary of processed records
 *
 * Merge semantics (idempotent):
 *   Re-processing the same punch is safe. checkIn = min(existing, new),
 *   checkOut = max(existing, new). Manual entries are never overwritten.
 *
 * Timezone:
 *   All shift-date determination uses Asia/Dhaka (UTC+6) regardless of
 *   server timezone. See punch-processor.ts for details.
 */

interface PunchRecord {
    userId: string;
    timestamp: string;
    type?: number; // 0=checkIn, 1=checkOut (ZKTeco convention)
}

export async function POST(req: Request) {
    try {
        // 1. Authenticate via API Key
        const auth = await authenticateSyncAgent(req);
        if (!auth.valid) return auth.response;
        const { apiKey } = auth;

        const body = await req.json();
        const records: PunchRecord[] = Array.isArray(body.records) ? body.records : [];
        const deviceIp = typeof body.deviceIp === "string" ? body.deviceIp.trim() : null;
        const devicePort = Number(body.devicePort) || 4370;

        if (records.length === 0) {
            return NextResponse.json(
                { success: false, error: "No records provided" },
                { status: 400 },
            );
        }

        const agentIp =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            "unknown";

        // 2. Delegate to the canonical punch processor
        const result = await ingestBiometricPunches({
            organizationId: apiKey.organizationId,
            records: records as BiometricPunchRecord[],
            source: "biometric",
            deviceId: undefined, // resolved below if deviceIp matches
            deviceName: deviceIp ? `Sync Agent (${deviceIp})` : "Sync Agent",
        });

        // 3. Update API key stats
        const syncedAt = new Date();
        await prisma.syncApiKey.update({
            where: { id: apiKey.id },
            data: {
                lastSyncAt: syncedAt,
                agentIp,
                agentVersion: body.agentVersion || apiKey.agentVersion,
                syncCount: { increment: 1 },
                totalRecords: { increment: result.synced },
            },
        });

        // 4. Update matching BiometricDevice card (if deviceIp + port matches)
        //    We also try to match by the SyncApiKey → BiometricDevice relation
        //    (added in migration 20260703000000_add_device_sync_api_key_relation).
        let deviceMatch: { id: string; name: string } | null = null;

        if (apiKey.id) {
            deviceMatch = await prisma.biometricDevice.findFirst({
                where: {
                    OR: [
                        { syncApiKeyId: apiKey.id },
                        ...(deviceIp
                            ? [
                                  {
                                      ip: deviceIp,
                                      port: devicePort,
                                  },
                              ]
                            : []),
                    ],
                    organizationId: apiKey.organizationId,
                },
                select: { id: true, name: true },
            });
        }

        if (deviceMatch) {
            const status =
                (result.errors?.length ?? 0) > 0 || result.unmappedUsers > 0
                    ? "partial"
                    : "success";
            await prisma.biometricDevice.update({
                where: { id: deviceMatch.id },
                data: {
                    lastSyncAt: syncedAt,
                    lastSyncStatus: status,
                    isOnline: true,
                    lastPingAt: syncedAt,
                    lastSeenAt: syncedAt,
                    consecutiveFailures: 0,
                    ...(apiKey.id ? { syncApiKeyId: apiKey.id } : {}),
                },
            });

            await prisma.deviceSyncLog.create({
                data: {
                    deviceId: deviceMatch.id,
                    status,
                    recordsSynced: result.synced,
                    recordsSkipped: result.skipped + result.unmappedUsers,
                    errorMessage:
                        (result.errors?.length ?? 0) > 0
                            ? result.errors!.slice(0, 3).join("; ")
                            : null,
                    syncDuration: null,
                },
            });
        }

        // 5. Return summary
        //    If we received records but synced 0 (all unmapped), return a
        //    "partial" success flag so the agent can surface a loud warning.
        const allUnmapped =
            result.synced === 0 && result.received > 0 && result.unmappedUsers > 0;

        return NextResponse.json(
            {
                success: !allUnmapped,
                code: allUnmapped ? "ALL_PUNCHES_UNMAPPED" : undefined,
                message: allUnmapped
                    ? "All received punches were for unmapped biometric user IDs. Please map employees to biometric user IDs in the device settings."
                    : undefined,
                summary: {
                    received: result.received,
                    synced: result.synced,
                    skipped: result.skipped,
                    unmappedUsers: result.unmappedUsers,
                    unmappedUserIds: result.unmappedUserIds,
                    attendanceDays: result.attendanceDays,
                    errors: result.errors,
                },
                timestamp: new Date().toISOString(),
            },
            { status: allUnmapped ? 422 : 200 },
        );
    } catch (error) {
        apiLogger.error({ err: error }, "SYNC_PUSH_ERROR");
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
