import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { biometricLogger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/biometric-devices/[id] — Get device details + recent sync logs
 */
export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;

        const device = await prisma.biometricDevice.findFirst({
            where: { id, organizationId: auth.organizationId },
            include: {
                branch: { select: { id: true, name: true, code: true } },
                syncLogs: {
                    orderBy: { syncedAt: "desc" },
                    take: 20,
                },
                cloudEvents: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                    select: {
                        id: true,
                        eventType: true,
                        status: true,
                        recordsReceived: true,
                        recordsSynced: true,
                        recordsSkipped: true,
                        unmappedUserIds: true,
                        errorMessage: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!device) {
            return new NextResponse("Device not found", { status: 404 });
        }

        return NextResponse.json(device);
    } catch (error) {
        biometricLogger.error({ err: error }, "GET_DEVICE_DETAIL_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * PUT /api/biometric-devices/[id] — Update device configuration
 */
export async function PUT(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id } = await params;
        const body = await req.json();
        const {
            name,
            ip,
            port,
            model,
            connectionType,
            connectionMode,
            cloudProtocol,
            serialNumber,
            location,
            branchId,
            syncInterval,
            timezone,
            setupNotes,
            isActive,
        } = body;

        // Verify device belongs to org
        const existing = await prisma.biometricDevice.findFirst({
            where: { id, organizationId: auth.organizationId },
        });
        if (!existing) {
            return new NextResponse("Device not found", { status: 404 });
        }

        const nextMode = connectionMode === "direct_cloud" ? "direct_cloud" : (connectionMode === "sync_agent" ? "sync_agent" : existing.connectionMode);
        const cleanSerial = typeof serialNumber === "string" ? serialNumber.trim() : (existing.serialNumber || "");
        const nextIp = nextMode === "direct_cloud" ? `adms:${cleanSerial}` : (ip || existing.ip);
        const nextPort = port || existing.port;

        if (nextMode === "direct_cloud" && !cleanSerial) {
            return NextResponse.json({ error: "Device serial number is required" }, { status: 400 });
        }

        // Check connection identity uniqueness if changed
        if (nextMode === "direct_cloud") {
            const duplicate = await prisma.biometricDevice.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    serialNumber: cleanSerial,
                    id: { not: id },
                },
            });
            if (duplicate) {
                return NextResponse.json({ error: "Another device with this serial number already exists" }, { status: 409 });
            }
        } else if ((ip && ip !== existing.ip) || (port && port !== existing.port)) {
            const duplicate = await prisma.biometricDevice.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    ip: nextIp,
                    port: nextPort,
                    id: { not: id },
                },
            });
            if (duplicate) {
                return NextResponse.json(
                    { error: "Another device with this IP and port already exists" },
                    { status: 409 }
                );
            }
        }

        const updated = await prisma.biometricDevice.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(ip !== undefined || connectionMode !== undefined || serialNumber !== undefined ? { ip: nextIp } : {}),
                ...(port !== undefined && { port }),
                ...(model !== undefined && { model }),
                ...(connectionType !== undefined && { connectionType }),
                ...(connectionMode !== undefined && { connectionMode: nextMode }),
                ...(cloudProtocol !== undefined && { cloudProtocol: cloudProtocol || null }),
                ...(serialNumber !== undefined && { serialNumber: cleanSerial || null }),
                ...(location !== undefined && { location }),
                ...(branchId !== undefined && { branchId: branchId || null }),
                ...(syncInterval !== undefined && { syncInterval }),
                ...(timezone !== undefined && { timezone: timezone || "Asia/Dhaka" }),
                ...(setupNotes !== undefined && { setupNotes: setupNotes || null }),
                ...(isActive !== undefined && { isActive }),
            },
            include: {
                branch: { select: { id: true, name: true, code: true } },
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        biometricLogger.error({ err: error }, "UPDATE_DEVICE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * DELETE /api/biometric-devices/[id] — Remove a device
 */
export async function DELETE(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id } = await params;

        const device = await prisma.biometricDevice.findFirst({
            where: { id, organizationId: auth.organizationId },
        });
        if (!device) {
            return new NextResponse("Device not found", { status: 404 });
        }

        // Cascade deletes sync logs too
        await prisma.biometricDevice.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        biometricLogger.error({ err: error }, "DELETE_DEVICE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
