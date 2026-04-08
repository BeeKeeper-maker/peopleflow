import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// GET /api/announcements — List announcements
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const activeOnly = searchParams.get("active") === "true";

        const where: Record<string, unknown> = {
            organizationId: auth.organizationId,
        };

        if (activeOnly) {
            where.isActive = true;
            where.publishDate = { lte: new Date() };
            where.OR = [
                { expiryDate: null },
                { expiryDate: { gte: new Date() } },
            ];
        }

        const announcements = await prisma.announcement.findMany({
            where,
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        photoUrl: true,
                    },
                },
            },
            orderBy: [
                { isPinned: "desc" },
                { priority: "desc" },
                { publishDate: "desc" },
            ],
        });

        return NextResponse.json(announcements);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_ANNOUNCEMENTS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST /api/announcements — Create an announcement
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr can create announcements
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const json = await req.json();
        const { title, content, type, priority, isPinned, publishDate, expiryDate, targetDepartments, isActive } = json;

        if (!title || !content) {
            return NextResponse.json(
                { error: "Title and content are required" },
                { status: 400 }
            );
        }

        // Find the employee record for the logged-in user to set as author
        const employee = await prisma.employee.findFirst({
            where: { userId: auth.userId, organizationId: auth.organizationId },
        });

        const announcement = await prisma.announcement.create({
            data: {
                title,
                content,
                type: type || "general",
                priority: priority || "medium",
                isPinned: isPinned || false,
                publishDate: publishDate ? new Date(publishDate) : new Date(),
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                targetDepartments: targetDepartments || null,
                isActive: isActive ?? true,
                authorId: employee?.id || null,
                organizationId: auth.organizationId,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        return NextResponse.json(announcement);
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_ANNOUNCEMENT_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
