import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

/**
 * DELETE /api/sync-agent/keys/[id] — Revoke (soft-delete) an API Key
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;

        const key = await prisma.syncApiKey.findFirst({
            where: { id, organizationId: auth.organizationId },
        });

        if (!key) {
            return new NextResponse("API key not found", { status: 404 });
        }

        await prisma.syncApiKey.update({
            where: { id },
            data: {
                isActive: false,
                revokedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "REVOKE_SYNC_KEY_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
