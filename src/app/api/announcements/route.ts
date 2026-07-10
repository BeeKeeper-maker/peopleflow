import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS, applyRateLimitHeaders } from "@/lib/rate-limit";

// GET /api/announcements — List announcements
//
// Visibility rules:
//   - admin / hr_admin / super_admin: see ALL announcements in the org
//     (including drafts and department-targeted ones they're not in).
//   - manager / employee: see only announcements where:
//       a) targetDepartments is NULL (org-wide), OR
//       b) targetDepartments includes their own department ID, OR
//       c) they have no department set (fallback: see org-wide only)
//
// The previous implementation ignored targetDepartments entirely, so a
// private HR-only announcement was visible to every employee — a real
// privacy leak for sensitive policy/celebration notices.
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Per-user rate limit (read op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, auth.userId);
    if (!rl.allowed) return rl.response!;

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

        // Department-targeting filter for non-HR roles
        const isHRLevel = ["super_admin", "admin", "hr_admin"].includes(auth.role);
        if (!isHRLevel) {
            // Look up the caller's employee record to get their departmentId
            const callerEmployee = await auth.withDB((db) =>
                db.employee.findFirst({
                    where: { userId: auth.userId, organizationId: auth.organizationId },
                    select: { departmentId: true },
                }),
            );
            const deptId = callerEmployee?.departmentId || null;

            // Visible if: org-wide (targetDepartments IS NULL) OR
            //             includes my department
            // If I have no department, I only see org-wide announcements.
            where.OR = [
                { targetDepartments: null },
                ...(deptId ? [{ targetDepartments: { contains: `"${deptId}"` } }] : []),
            ];
        }

        const announcements = await auth.withDB((db) =>
            db.announcement.findMany({
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
            }),
        );

        return applyRateLimitHeaders(NextResponse.json(announcements), rl.headers);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "GET_ANNOUNCEMENTS_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
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

    // Per-user rate limit (write op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.write, auth.userId);
    if (!rl.allowed) return rl.response!;

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
        const employee = await auth.withDB((db) =>
            db.employee.findFirst({
                where: { userId: auth.userId, organizationId: auth.organizationId },
            }),
        );

        const announcement = await auth.withDB((db) =>
            db.announcement.create({
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
            }),
        );

        return NextResponse.json(announcement);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "CREATE_ANNOUNCEMENT_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
