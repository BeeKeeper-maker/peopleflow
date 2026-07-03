import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

const subscribeSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
    }),
    expirationTime: z.number().nullable().optional(),
});

/**
 * POST /api/notifications/push/subscribe — Register a web push subscription
 *
 * Called by the browser's ServiceWorkerManager when the user grants
 * push notification permission. Stores the subscription so the server
 * can send push messages later via the Web Push API.
 *
 * The subscription is stored in NotificationPreference.pushSubscription
 * (one subscription per user — the most recent device).
 *
 * Body: PushSubscriptionJSON from the browser
 */
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = subscribeSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid subscription", details: validation.error.issues },
                { status: 400 },
            );
        }

        const subscription = {
            endpoint: validation.data.endpoint,
            keys: validation.data.keys,
            expirationTime: validation.data.expirationTime ?? null,
        };

        // Upsert preferences with the push subscription + enable push
        await prisma.notificationPreference.upsert({
            where: { userId: ctx.userId },
            create: {
                userId: ctx.userId,
                pushEnabled: true,
                pushSubscription: subscription as object,
            },
            update: {
                pushEnabled: true,
                pushSubscription: subscription as object,
            },
        });

        apiLogger.info(
            { userId: ctx.userId, endpoint: subscription.endpoint.substring(0, 50) + "..." },
            "Push subscription registered",
        );

        return NextResponse.json({
            success: true,
            message: "Push notifications enabled on this device.",
        });
    } catch (error) {
        apiLogger.error({ err: error }, "PUSH_SUBSCRIBE_ERROR");
        return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
    }
}
