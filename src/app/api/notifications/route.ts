import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";

// GET - List notifications for current user
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return new NextResponse("User not found", { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const unreadOnly = searchParams.get("unread") === "true";
        const limit = parseInt(searchParams.get("limit") || "20");

        const where: any = { userId: user.id };
        if (unreadOnly) {
            where.isRead = false;
        }

        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
            }),
            prisma.notification.count({
                where: { userId: user.id, isRead: false },
            }),
        ]);

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_NOTIFICATIONS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST - Create a notification (internal use)
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { userId, title, message, type, link } = body;

        if (!userId || !title || !message || !type) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
                link,
            },
        });

        return NextResponse.json(notification);
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_NOTIFICATION_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// PATCH - Mark notifications as read
export async function PATCH(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return new NextResponse("User not found", { status: 404 });
        }

        const body = await req.json();
        const { notificationIds, markAll } = body;

        if (markAll) {
            // Mark all as read
            await prisma.notification.updateMany({
                where: { userId: user.id, isRead: false },
                data: { isRead: true, readAt: new Date() },
            });
        } else if (notificationIds && notificationIds.length > 0) {
            // Mark specific notifications as read
            await prisma.notification.updateMany({
                where: {
                    id: { in: notificationIds },
                    userId: user.id,
                },
                data: { isRead: true, readAt: new Date() },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "MARK_READ_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
