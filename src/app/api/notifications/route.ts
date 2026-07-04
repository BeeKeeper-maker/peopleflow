import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// GET - List notifications for current user
export async function GET(req: Request) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { searchParams } = new URL(req.url);
        const unreadOnly = searchParams.get("unread") === "true";
        const limit = parseInt(searchParams.get("limit") || "20");

        const where: { userId: string; isRead?: boolean } = { userId: auth.userId };
        if (unreadOnly) {
            where.isRead = false;
        }

        const [notifications, unreadCount] = await auth.withDB((db) =>
            Promise.all([
                db.notification.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    take: limit,
                }),
                db.notification.count({
                    where: { userId: auth.userId, isRead: false },
                }),
            ]),
        );

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_NOTIFICATIONS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST - Create a notification (internal use)
export async function POST(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const body = await req.json();
        const { userId, title, message, type, link } = body;

        if (!userId || !title || !message || !type) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const targetUser = await auth.withDB((db) =>
            db.user.findFirst({
                where: { id: userId, organizationId: auth.organizationId },
                select: { id: true },
            }),
        );

        if (!targetUser) {
            return new NextResponse("Target user not found", { status: 404 });
        }

        const notification = await auth.withDB((db) =>
            db.notification.create({
                data: {
                    userId,
                    title,
                    message,
                    type,
                    link,
                },
            }),
        );

        return NextResponse.json(notification);
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_NOTIFICATION_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// PATCH - Mark notifications as read
export async function PATCH(req: Request) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const body = await req.json();
        const { notificationIds, markAll } = body;

        if (markAll) {
            // Mark all as read
            await auth.withDB((db) =>
                db.notification.updateMany({
                    where: { userId: auth.userId, isRead: false },
                    data: { isRead: true, readAt: new Date() },
                }),
            );
        } else if (notificationIds && notificationIds.length > 0) {
            // Mark specific notifications as read
            await auth.withDB((db) =>
                db.notification.updateMany({
                    where: {
                        id: { in: notificationIds },
                        userId: auth.userId,
                    },
                    data: { isRead: true, readAt: new Date() },
                }),
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "MARK_READ_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
