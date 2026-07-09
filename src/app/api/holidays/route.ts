import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS, applyRateLimitHeaders } from "@/lib/rate-limit";

// GET /api/holidays — List holiday lists (filter by year)
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Per-user rate limit (read op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, auth.userId);
    if (!rl.allowed) return rl.response!;

    try {
        const { searchParams } = new URL(req.url);
        const year = searchParams.get("year");

        const where: Record<string, unknown> = {
            organizationId: auth.organizationId,
        };

        if (year) {
            where.year = parseInt(year, 10);
        }

        const holidayLists = await auth.withDB((db) =>
            db.holidayList.findMany({
                where,
                include: {
                    holidays: {
                        orderBy: { date: "asc" },
                    },
                },
                orderBy: { year: "desc" },
            }),
        );

        return applyRateLimitHeaders(NextResponse.json(holidayLists), rl.headers);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "GET_HOLIDAYS_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

// POST /api/holidays — Create a new holiday list
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr can create holiday lists
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    // Per-user rate limit (write op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.write, auth.userId);
    if (!rl.allowed) return rl.response!;

    try {
        const json = await req.json();
        const { name, year } = json;

        if (!name || !year) {
            return NextResponse.json(
                { error: "Name and year are required" },
                { status: 400 }
            );
        }

        // Check for duplicate year
        const existing = await auth.withDB((db) =>
            db.holidayList.findUnique({
                where: {
                    organizationId_year: {
                        organizationId: auth.organizationId,
                        year: parseInt(year, 10),
                    },
                },
            }),
        );

        if (existing) {
            return NextResponse.json(
                { error: "A holiday list for this year already exists" },
                { status: 409 }
            );
        }

        const holidayList = await auth.withDB((db) =>
            db.holidayList.create({
                data: {
                    name,
                    year: parseInt(year, 10),
                    organizationId: auth.organizationId,
                },
                include: {
                    holidays: true,
                },
            }),
        );

        return NextResponse.json(holidayList);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "CREATE_HOLIDAY_LIST_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
