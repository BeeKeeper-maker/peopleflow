import { NextResponse } from "next/server";
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

        const key = await auth.withDB((db) =>
            db.syncApiKey.findFirst({
                where: { id, organizationId: auth.organizationId },
            }),
        );

        if (!key) {
            return new NextResponse("API key not found", { status: 404 });
        }

        await auth.withDB((db) =>
            db.syncApiKey.update({
                where: { id },
                data: {
                    isActive: false,
                    revokedAt: new Date(),
                },
            }),
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "REVOKE_SYNC_KEY_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
