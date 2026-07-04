import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { getAdapter } from "@/lib/biometric/device-adapter";
import "@/lib/biometric/zkteco-adapter";
import { biometricLogger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/biometric-devices/[id]/users — Get users registered on device
 * Also returns mapping status (which device users are mapped to employees)
 */
export async function GET(req: Request, { params }: RouteParams) {
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

        // Connect to device and get users
        let adapter;
        try {
            adapter = getAdapter(device.model);
        } catch {
            return NextResponse.json({
                success: false,
                message: `Device brand "${device.model}" is not supported yet. Currently only ZKTeco devices are supported.`,
                users: [],
            });
        }
        const connResult = await adapter.connect(device.ip, device.port);

        if (!connResult.success) {
            return NextResponse.json({
                success: false,
                message: connResult.message,
                users: [],
            });
        }

        try {
            const deviceUsers = await adapter.getUsers();

            // Get employees with biometric IDs for mapping status
            const employees = await auth.withDB((db) => db.employee.findMany({
                where: {
                    organizationId: auth.organizationId,
                    biometricUserId: { not: null },
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                    biometricUserId: true,
                },
            }));

            const employeeMap = new Map(
                employees.map((e) => [e.biometricUserId!, e])
            );

            // Enrich device users with employee mapping info
            const enrichedUsers = deviceUsers.map((u) => ({
                ...u,
                mappedEmployee: employeeMap.get(u.userId) || null,
            }));

            return NextResponse.json({
                success: true,
                users: enrichedUsers,
            });
        } finally {
            await adapter.disconnect();
        }
    } catch (error) {
        biometricLogger.error({ err: error }, "GET_DEVICE_USERS_ERROR");
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { success: false, message: errMsg, users: [] },
            { status: 200 }
        );
    }
}
