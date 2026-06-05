import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { biometricLogger } from "@/lib/logger";
import { ingestBiometricPunches, type BiometricPunchRecord } from "@/lib/biometric/attendance-ingest";

const MAX_CAPTURE_BODY_CHARS = 120_000;
const DEVICE_OK = "OK";

interface AdmsRequestContext {
    serialNumber: string | null;
    query: Record<string, string>;
    bodyText: string;
    remoteIp: string;
    path: string;
    method: string;
}

function getSerialFromQuery(searchParams: URLSearchParams): string | null {
    const candidates = ["SN", "sn", "SerialNumber", "serialNumber", "DeviceID", "deviceId"];
    for (const key of candidates) {
        const value = searchParams.get(key)?.trim();
        if (value) return value;
    }
    return null;
}

function queryToObject(searchParams: URLSearchParams): Record<string, string> {
    const out: Record<string, string> = {};
    searchParams.forEach((value, key) => {
        out[key] = value;
    });
    return out;
}

function safeHeaders(req: Request): Record<string, string> {
    const allow = [
        "content-type",
        "user-agent",
        "x-forwarded-for",
        "x-real-ip",
        "host",
        "accept",
    ];
    const out: Record<string, string> = {};
    for (const key of allow) {
        const value = req.headers.get(key);
        if (value) out[key] = value;
    }
    return out;
}

function getRemoteIp(req: Request): string {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

async function buildContext(req: Request): Promise<AdmsRequestContext> {
    const url = new URL(req.url);
    const bodyText = req.method === "POST" || req.method === "PUT" ? await req.text() : "";
    return {
        serialNumber: getSerialFromQuery(url.searchParams),
        query: queryToObject(url.searchParams),
        bodyText: bodyText.slice(0, MAX_CAPTURE_BODY_CHARS),
        remoteIp: getRemoteIp(req),
        path: url.pathname,
        method: req.method,
    };
}

function parseTimestamp(value: string): string | null {
    const normalized = value.trim().replace(/^"|"$/g, "");
    if (!normalized) return null;

    // ZKTeco commonly sends `YYYY-MM-DD HH:mm:ss`. Make it browser/Node safe.
    const isoCandidate = normalized.includes("T") ? normalized : normalized.replace(" ", "T");
    const date = new Date(isoCandidate);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

export function parseAdmsAttendanceLogs(bodyText: string, serialNumber?: string | null): BiometricPunchRecord[] {
    const lines = bodyText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const records: BiometricPunchRecord[] = [];

    for (const line of lines) {
        // Most ZKTeco ADMS ATTLOG payloads are tab-separated:
        // PIN<TAB>Time<TAB>Status<TAB>Verify<TAB>WorkCode...
        const columns = line.split(/\t+/).map((part) => part.trim());
        if (columns.length < 2) continue;

        const userId = columns[0];
        const timestamp = parseTimestamp(columns[1]);
        if (!userId || !timestamp) continue;

        const type = Number.isFinite(Number(columns[2])) ? Number(columns[2]) : undefined;
        const state = Number.isFinite(Number(columns[3])) ? Number(columns[3]) : undefined;

        records.push({ userId, timestamp, type, state, serialNumber: serialNumber || undefined });
    }

    return records;
}

function isAttendanceUpload(query: Record<string, string>, bodyText: string): boolean {
    const table = (query.table || query.Table || "").toLowerCase();
    if (table === "attlog") return true;
    return /\d+\t\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(bodyText);
}

async function findDirectCloudDevice(serialNumber: string | null) {
    if (!serialNumber) return null;
    return prisma.biometricDevice.findFirst({
        where: {
            serialNumber,
            isActive: true,
            connectionMode: "direct_cloud",
        },
        select: {
            id: true,
            organizationId: true,
            serialNumber: true,
            name: true,
        },
    });
}

async function captureEvent(params: {
    req: Request;
    ctx: AdmsRequestContext;
    eventType: string;
    status: string;
    deviceId?: string | null;
    organizationId?: string | null;
    recordsReceived?: number;
    recordsSynced?: number;
    recordsSkipped?: number;
    unmappedUserIds?: string[];
    errorMessage?: string | null;
}) {
    const { req, ctx } = params;
    return prisma.biometricCloudEvent.create({
        data: {
            serialNumber: ctx.serialNumber,
            eventType: params.eventType,
            method: ctx.method,
            path: ctx.path,
            query: ctx.query,
            headers: safeHeaders(req),
            body: ctx.bodyText || null,
            status: params.status,
            recordsReceived: params.recordsReceived || 0,
            recordsSynced: params.recordsSynced || 0,
            recordsSkipped: params.recordsSkipped || 0,
            unmappedUserIds: params.unmappedUserIds || [],
            errorMessage: params.errorMessage || null,
            remoteIp: ctx.remoteIp,
            organizationId: params.organizationId || null,
            deviceId: params.deviceId || null,
        },
    });
}

function deviceOptionsResponse(serialNumber: string | null) {
    const sn = serialNumber || "UNKNOWN";
    const body = [
        `GET OPTION FROM: ${sn}`,
        "ATTLOGStamp=0",
        "OPERLOGStamp=0",
        "ATTPHOTOStamp=0",
        "ErrorDelay=30",
        "Delay=10",
        "TransTimes=00:00;14:00",
        "TransInterval=1",
        "TransFlag=1111000000",
        "Realtime=1",
        "Encrypt=0",
        "ServerName=PeopleFlow",
        "",
    ].join("\n");

    return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}

function plainOk(body = DEVICE_OK) {
    return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}

export async function handleAdmsRequest(req: Request, eventType: "registry" | "cdata" | "getrequest" | "devicecmd") {
    const ctx = await buildContext(req);
    const device = await findDirectCloudDevice(ctx.serialNumber);
    const now = new Date();

    try {
        if (!device) {
            await captureEvent({
                req,
                ctx,
                eventType,
                status: "unknown_device",
                errorMessage: ctx.serialNumber ? "Serial is not registered for direct-cloud sync" : "Device did not provide serial number",
            });

            // Keep device protocol alive so the admin can see captured serial/payload and claim it.
            if (eventType === "cdata" && req.method === "GET") return deviceOptionsResponse(ctx.serialNumber);
            return plainOk();
        }

        await prisma.biometricDevice.update({
            where: { id: device.id },
            data: {
                lastSeenAt: now,
                lastPingAt: now,
                isOnline: true,
                cloudStatus: "connected",
                cloudProtocol: "adms",
                consecutiveFailures: 0,
            },
        });

        if (eventType === "cdata" && req.method === "GET") {
            await captureEvent({ req, ctx, eventType, status: "captured", deviceId: device.id, organizationId: device.organizationId });
            return deviceOptionsResponse(ctx.serialNumber);
        }

        if (eventType === "cdata" && req.method === "POST" && isAttendanceUpload(ctx.query, ctx.bodyText)) {
            const records = parseAdmsAttendanceLogs(ctx.bodyText, ctx.serialNumber);
            const result = records.length > 0
                ? await ingestBiometricPunches({ organizationId: device.organizationId, records })
                : { received: 0, synced: 0, skipped: 0, unmappedUsers: 0, unmappedUserIds: [], attendanceDays: 0 };

            const status = result.synced > 0 && result.unmappedUsers === 0 && !result.errors ? "processed" : "partial";

            await prisma.biometricDevice.update({
                where: { id: device.id },
                data: {
                    lastSyncAt: now,
                    lastSyncStatus: status === "processed" ? "success" : "partial",
                    lastSeenAt: now,
                    lastPingAt: now,
                    isOnline: true,
                    cloudStatus: status === "processed" ? "connected" : "warning",
                },
            });

            await prisma.deviceSyncLog.create({
                data: {
                    deviceId: device.id,
                    status: status === "processed" ? "success" : "partial",
                    recordsSynced: result.synced,
                    recordsSkipped: result.skipped + result.unmappedUsers,
                    errorMessage: result.errors?.join("; ") || (result.unmappedUserIds.length ? `Unmapped biometric IDs: ${result.unmappedUserIds.join(", ")}` : null),
                    syncDuration: null,
                },
            });

            await captureEvent({
                req,
                ctx,
                eventType,
                status,
                deviceId: device.id,
                organizationId: device.organizationId,
                recordsReceived: result.received,
                recordsSynced: result.synced,
                recordsSkipped: result.skipped + result.unmappedUsers,
                unmappedUserIds: result.unmappedUserIds,
                errorMessage: result.errors?.join("; ") || null,
            });

            return plainOk();
        }

        await captureEvent({ req, ctx, eventType, status: "captured", deviceId: device.id, organizationId: device.organizationId });
        return plainOk();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        biometricLogger.error({ err: error, eventType, serialNumber: ctx.serialNumber }, "ADMS_REQUEST_ERROR");
        await captureEvent({
            req,
            ctx,
            eventType,
            status: "failed",
            deviceId: device?.id || null,
            organizationId: device?.organizationId || null,
            errorMessage: message,
        }).catch(() => undefined);
        return plainOk();
    }
}
