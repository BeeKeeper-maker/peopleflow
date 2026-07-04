import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { enforcePlanLimit, onResourceCreated } from "@/lib/plan-enforcement";
import { biometricLogger } from "@/lib/logger";

/**
 * GET /api/biometric-devices — List all devices for organization
 */
export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const devices = await auth.withDB((db) => db.biometricDevice.findMany({
            where: { organizationId: auth.organizationId },
            include: {
                branch: { select: { id: true, name: true, code: true } },
                _count: { select: { syncLogs: true } },
            },
            orderBy: { createdAt: "desc" },
        }));

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
        } = body;

        const mode = connectionMode === "direct_cloud" ? "direct_cloud" : "sync_agent";
        const cleanSerial = typeof serialNumber === "string" ? serialNumber.trim() : "";
        const normalizedIp = mode === "direct_cloud" ? `adms:${cleanSerial}` : String(ip || "").trim();

        // Validate required fields
        if (!name || (mode === "sync_agent" && !normalizedIp) || (mode === "direct_cloud" && !cleanSerial)) {
            return NextResponse.json(
                { error: mode === "direct_cloud" ? "Device serial number is required" : "Name and IP are required" },
                { status: 400 }
            );
        }

        const planCheck = await enforcePlanLimit(auth.organizationId, "device");
        if (!planCheck.allowed) {
            return NextResponse.json(
                {
                    error: planCheck.message,
                    code: planCheck.code,
                    title: planCheck.title,
                    action: planCheck.action,
                    upgradeRequired: planCheck.upgradeRequired,
                    current: planCheck.current,
                    limit: planCheck.limit,
                },
                { status: 402 }
            );
        }

        // Check for duplicate connection identity in same org
        const existing = await auth.withDB((db) => db.biometricDevice.findFirst({
            where: mode === "direct_cloud"
                ? { organizationId: auth.organizationId, serialNumber: cleanSerial }
                : {
                    organizationId: auth.organizationId,
                    ip: normalizedIp,
                    port: port || 4370,
                },
        }));

        if (existing) {
            return NextResponse.json(
                { error: mode === "direct_cloud" ? "A device with this serial number already exists" : "A device with this IP and port already exists" },
                { status: 409 }
            );
        }

        // Validate branchId if provided
        if (branchId) {
            const branch = await auth.withDB((db) => db.branch.findFirst({
                where: { id: branchId, organizationId: auth.organizationId },
            }));
            if (!branch) {
                return NextResponse.json({ error: "Branch not found" }, { status: 400 });
            }
        }

        const device = await auth.withDB((db) => db.biometricDevice.create({
            data: {
                name,
                ip: normalizedIp,
                port: port || 4370,
                model: model || "ZKTeco",
                connectionType: connectionType || (mode === "direct_cloud" ? "adms" : "tcp"),
                connectionMode: mode,
                cloudProtocol: mode === "direct_cloud" ? (cloudProtocol || "adms") : null,
                cloudStatus: mode === "direct_cloud" ? "pending" : "pending",
                serialNumber: cleanSerial || null,
                location: location || null,
                branchId: branchId || null,
                syncInterval: syncInterval || 15,
                timezone: timezone || "Asia/Dhaka",
                setupNotes: setupNotes || null,
                organizationId: auth.organizationId,
            },
            include: {
                branch: { select: { id: true, name: true, code: true } },
            },
        }));

        await onResourceCreated(auth.organizationId, "device");

        return NextResponse.json(device, { status: 201 });
    } catch (error) {
        biometricLogger.error({ err: error }, "CREATE_BIOMETRIC_DEVICE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
