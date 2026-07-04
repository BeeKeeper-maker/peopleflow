import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { biometricLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/biometric-devices/adms-capture
 * Shows recent direct-cloud ADMS/iClock payloads for the current tenant and unknown devices.
 * Used during device certification/setup so office admins can see whether a terminal is reaching PeopleFlow.
 */
export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const url = new URL(req.url);
        const serialNumber = url.searchParams.get("serialNumber")?.trim();
        const includeUnknown = url.searchParams.get("includeUnknown") !== "false";

        const events = await auth.withDB((db) => db.biometricCloudEvent.findMany({
            where: {
                ...(serialNumber ? { serialNumber } : {}),
                OR: [
                    { organizationId: auth.organizationId },
                    ...(includeUnknown ? [{ organizationId: null }] : []),
                ],
            },
            select: {
                id: true,
                serialNumber: true,
                eventType: true,
                method: true,
                path: true,
                query: true,
                status: true,
                recordsReceived: true,
                recordsSynced: true,
                recordsSkipped: true,
                unmappedUserIds: true,
                errorMessage: true,
                remoteIp: true,
                createdAt: true,
                device: { select: { id: true, name: true, serialNumber: true, cloudStatus: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        }));

        return NextResponse.json({ success: true, events });
    } catch (error) {
        biometricLogger.error({ err: error }, "LIST_ADMS_CAPTURE_EVENTS_ERROR");
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
    }
}
