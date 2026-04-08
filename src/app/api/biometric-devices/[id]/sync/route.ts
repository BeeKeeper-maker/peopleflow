import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { syncDevice } from "@/lib/biometric/sync-engine";
import { biometricLogger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/biometric-devices/[id]/sync — Trigger manual sync
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
        const device = await prisma.biometricDevice.findFirst({
            where: { id, organizationId: auth.organizationId },
        });

        if (!device) {
            return new NextResponse("Device not found", { status: 404 });
        }

        // Run sync
        const result = await syncDevice(id);

        return NextResponse.json(result);
    } catch (error) {
        biometricLogger.error({ err: error }, "SYNC_DEVICE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
