import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { getAdapter } from "@/lib/biometric/device-adapter";
import "@/lib/biometric/zkteco-adapter";
import { biometricLogger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/biometric-devices/[id]/test — Test device connectivity
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id } = await params;

        const device = await auth.withDB((db) => db.biometricDevice.findFirst({
            where: { id, organizationId: auth.organizationId },
        }));

        if (!device) {
            return new NextResponse("Device not found", { status: 404 });
        }

        // Get adapter for this device brand
        let adapter;
        try {
            adapter = getAdapter(device.model);
        } catch {
            return NextResponse.json({
                success: false,
                message: `Device brand "${device.model}" is not supported yet. Currently only ZKTeco devices are supported.`,
            });
        }

        // Test connection
        const result = await adapter.testConnection(device.ip, device.port);

        return NextResponse.json({
            success: result.success,
            message: result.message,
            deviceInfo: result.deviceInfo || null,
        });
    } catch (error) {
        biometricLogger.error({ err: error }, "TEST_DEVICE_ERROR");
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { success: false, message: errMsg },
            { status: 200 } // Not 500 — test failures are expected responses
        );
    }
}
