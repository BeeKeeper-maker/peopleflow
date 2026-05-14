import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { toPlainSettings } from "@/lib/settings-json";

/**
 * GET /api/settings/geo-fence — Get geo-fence configuration
 * Returns geo-fence enabled status, enforcement mode, and branch GPS coords
 */
export async function GET() {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const org = await prisma.organization.findUnique({
            where: { id: auth.organizationId },
            select: { settings: true },
        });

        const settings = toPlainSettings(org?.settings);

        // Get branches with their GPS config
        const branches = await prisma.branch.findMany({
            where: { organizationId: auth.organizationId, isActive: true },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                geoFenceRadius: true,
                _count: { select: { employees: true } },
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            geoFenceEnabled: settings.geoFenceEnabled === true,
            geoFenceEnforcement: settings.geoFenceEnforcement || "soft", // "strict" | "soft"
            branches,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_GEO_FENCE_SETTINGS_ERROR");
        return NextResponse.json({ error: "Failed to fetch geo-fence settings" }, { status: 500 });
    }
}

/**
 * PATCH /api/settings/geo-fence — Update geo-fence configuration
 * Body: { geoFenceEnabled: boolean, geoFenceEnforcement: "strict" | "soft" }
 */
export async function PATCH(req: NextRequest) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const body = await req.json();
        const { geoFenceEnabled, geoFenceEnforcement } = body;

        // Validate enforcement mode
        if (geoFenceEnforcement && !["strict", "soft"].includes(geoFenceEnforcement)) {
            return NextResponse.json(
                { error: "geoFenceEnforcement must be 'strict' or 'soft'" },
                { status: 400 }
            );
        }

        // Read current settings, merge geo-fence config
        const org = await prisma.organization.findUnique({
            where: { id: auth.organizationId },
            select: { settings: true },
        });

        const currentSettings = toPlainSettings(org?.settings);

        const updatedSettings = {
            ...currentSettings,
            ...(geoFenceEnabled !== undefined && { geoFenceEnabled }),
            ...(geoFenceEnforcement !== undefined && { geoFenceEnforcement }),
        };

        await prisma.organization.update({
            where: { id: auth.organizationId },
            data: { settings: updatedSettings },
        });

        return NextResponse.json({
            success: true,
            geoFenceEnabled: updatedSettings.geoFenceEnabled,
            geoFenceEnforcement: updatedSettings.geoFenceEnforcement,
            message: geoFenceEnabled
                ? `Geo-fence সক্রিয় করা হয়েছে (${geoFenceEnforcement || "soft"} মোড)`
                : "Geo-fence নিষ্ক্রিয় করা হয়েছে",
        });
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_GEO_FENCE_SETTINGS_ERROR");
        return NextResponse.json({ error: "Failed to update geo-fence settings" }, { status: 500 });
    }
}
