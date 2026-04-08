import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { biometricLogger } from "@/lib/logger";

/**
 * GET /api/biometric-devices — List all devices for organization
 */
export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const devices = await prisma.biometricDevice.findMany({
            where: { organizationId: auth.organizationId },
            include: {
                branch: { select: { id: true, name: true, code: true } },
                _count: { select: { syncLogs: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(devices);
    } catch (error) {
        biometricLogger.error({ err: error }, "GET_BIOMETRIC_DEVICES_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * POST /api/biometric-devices — Add a new device
 */
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr_admin can add devices
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const body = await req.json();
        const { name, ip, port, model, connectionType, location, branchId, syncInterval } = body;

        // Validate required fields
        if (!name || !ip) {
            return NextResponse.json({ error: "Name and IP are required" }, { status: 400 });
        }

        // Check for duplicate IP+port in same org
        const existing = await prisma.biometricDevice.findFirst({
            where: {
                organizationId: auth.organizationId,
                ip,
                port: port || 4370,
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: "A device with this IP and port already exists" },
                { status: 409 }
            );
        }

        // Validate branchId if provided
        if (branchId) {
            const branch = await prisma.branch.findFirst({
                where: { id: branchId, organizationId: auth.organizationId },
            });
            if (!branch) {
                return NextResponse.json({ error: "Branch not found" }, { status: 400 });
            }
        }

        const device = await prisma.biometricDevice.create({
            data: {
                name,
                ip,
                port: port || 4370,
                model: model || "ZKTeco",
                connectionType: connectionType || "tcp",
                location: location || null,
                branchId: branchId || null,
                syncInterval: syncInterval || 15,
                organizationId: auth.organizationId,
            },
            include: {
                branch: { select: { id: true, name: true, code: true } },
            },
        });

        return NextResponse.json(device, { status: 201 });
    } catch (error) {
        biometricLogger.error({ err: error }, "CREATE_BIOMETRIC_DEVICE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
