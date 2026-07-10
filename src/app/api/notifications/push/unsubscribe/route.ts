import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/notifications/push/unsubscribe — Remove web push subscription
 *
 * Called when the user revokes push permission or logs out.
 * Clears the stored subscription and disables push for the user.
 */
export async function POST() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        await auth.withDB((db) => db.notificationPreference.updateMany({
            where: { userId: ctx.userId },
            data: {
                pushEnabled: false,
                pushSubscription: Prisma.JsonNull,
            },
        }));

        apiLogger.info({ userId: ctx.userId }, "Push subscription removed");

        return NextResponse.json({
            success: true,
            message: "Push notifications disabled.",
        });
    } catch (error) {
        apiLogger.error({ err: error }, "PUSH_UNSUBSCRIBE_ERROR");
        return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
    }
}
