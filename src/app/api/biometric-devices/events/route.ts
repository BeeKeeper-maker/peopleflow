import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma";
import { biometricLogger } from "@/lib/logger";

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 100)));
        const status = searchParams.get("status") || "all";
        const eventType = searchParams.get("eventType") || "all";
        const serial = searchParams.get("serial")?.trim();

        const where: Prisma.BiometricCloudEventWhereInput = {
            OR: [
                { organizationId: auth.organizationId },
                { device: { organizationId: auth.organizationId } },
            ],
        };

        if (status !== "all") where.status = status;
        if (eventType !== "all") where.eventType = eventType;
        if (serial) where.serialNumber = { contains: serial, mode: "insensitive" };

        const events = await prisma.biometricCloudEvent.findMany({
            where,
            select: {
                id: true,
                serialNumber: true,
                eventType: true,
                method: true,
                status: true,
                recordsReceived: true,
                recordsSynced: true,
                recordsSkipped: true,
                unmappedUserIds: true,
                errorMessage: true,
                remoteIp: true,
                createdAt: true,
                device: {
                    select: {
                        id: true,
                        name: true,
                        location: true,
                        cloudStatus: true,
                        lastSeenAt: true,
                        branch: { select: { name: true, code: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return NextResponse.json(events);
    } catch (error) {
        biometricLogger.error({ err: error }, "GET_BIOMETRIC_EVENTS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
