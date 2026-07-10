import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotifications, type PushSubscription } from "@/lib/web-push";
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/notifications/push/send
 *
 * Internal endpoint (called by the event worker) to send a push notification
 * to all of the calling user's subscribed devices.
 *
 * Body: { title, message, url? }
 *
 * Notes:
 *   - This endpoint is authenticated via requireAuth() to prevent external
 *     abuse; the worker calls it with a service-account session.
 *   - A user may have only one pushSubscription stored at a time (the most
 *     recent device — see /api/notifications/push/subscribe). We send to that
 *     single subscription; the helper signature accepts an array for future
 *     expansion.
 */
export async function POST(req: NextRequest) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const body = await req.json();
        const { title, message, url } = body ?? {};

        if (!title || !message) {
            return NextResponse.json(
                { error: "Title and message are required" },
                { status: 400 },
            );
        }

        // Fetch the user's stored push subscription (if any)
        const prefs = await prisma.notificationPreference.findUnique({
            where: { userId: auth.userId },
            select: { pushSubscription: true },
        });

        // pushSubscription is a Prisma Json? field — stored as an object,
        // not a stringified JSON. Filter out null/invalid shapes.
        const subscriptions: PushSubscription[] = [];
        if (prefs?.pushSubscription && typeof prefs.pushSubscription === "object") {
            const sub = prefs.pushSubscription as Record<string, unknown>;
            if (
                typeof sub.endpoint === "string" &&
                sub.keys &&
                typeof sub.keys === "object"
            ) {
                const keys = sub.keys as { p256dh?: string; auth?: string };
                if (keys.p256dh && keys.auth) {
                    subscriptions.push({
                        endpoint: sub.endpoint,
                        keys: { p256dh: keys.p256dh, auth: keys.auth },
                        expirationTime:
                            typeof sub.expirationTime === "number"
                                ? sub.expirationTime
                                : null,
                    });
                }
            }
        }

        if (subscriptions.length === 0) {
            return NextResponse.json({ sent: 0, message: "No push subscriptions" });
        }

        const sent = await sendPushNotifications(subscriptions, {
            title,
            body: message,
            url,
        });

        return NextResponse.json({ sent, total: subscriptions.length });
    } catch (error) {
        apiLogger.error({ err: error }, "Push send failed");
        return NextResponse.json({ error: "Failed to send push" }, { status: 500 });
    }
}
