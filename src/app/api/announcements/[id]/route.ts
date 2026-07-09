import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// PUT /api/announcements/[id] — Update an announcement
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr can update announcements
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id } = await params;
        const json = await req.json();

        const existing = await auth.withDB((db) =>
            db.announcement.findFirst({
                where: { id, organizationId: auth.organizationId },
            }),
        );

        if (!existing) {
            return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
        }

        const announcement = await auth.withDB((db) =>
            db.announcement.update({
                where: { id },
                data: {
                    title: json.title ?? existing.title,
                    content: json.content ?? existing.content,
                    type: json.type ?? existing.type,
                    isPinned: json.isPinned ?? existing.isPinned,
                    publishDate: json.publishDate ? new Date(json.publishDate) : existing.publishDate,
                    expiryDate: json.expiryDate ? new Date(json.expiryDate) : json.expiryDate === null ? null : existing.expiryDate,
                    targetDepartments: json.targetDepartments !== undefined ? json.targetDepartments : existing.targetDepartments,
                    isActive: json.isActive ?? existing.isActive,
                },
            }),
        );

        return NextResponse.json(announcement);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "UPDATE_ANNOUNCEMENT_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

// DELETE /api/announcements/[id] — Delete an announcement
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr can delete announcements
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const { id } = await params;

        const existing = await auth.withDB((db) =>
            db.announcement.findFirst({
                where: { id, organizationId: auth.organizationId },
            }),
        );

        if (!existing) {
            return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
        }

        await auth.withDB((db) => db.announcement.delete({ where: { id } }));

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "DELETE_ANNOUNCEMENT_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
