import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

// GET /api/holidays — List holiday lists (filter by year)
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const year = searchParams.get("year");

        const where: Record<string, unknown> = {
            organizationId: auth.organizationId,
        };

        if (year) {
            where.year = parseInt(year, 10);
        }

        const holidayLists = await prisma.holidayList.findMany({
            where,
            include: {
                holidays: {
                    orderBy: { date: "asc" },
                },
            },
            orderBy: { year: "desc" },
        });

        return NextResponse.json(holidayLists);
    } catch (error) {
        console.error("GET_HOLIDAYS_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
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
        const existing = await prisma.holidayList.findUnique({
            where: {
                organizationId_year: {
                    organizationId: auth.organizationId,
                    year: parseInt(year, 10),
                },
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: "A holiday list for this year already exists" },
                { status: 409 }
            );
        }

        const holidayList = await prisma.holidayList.create({
            data: {
                name,
                year: parseInt(year, 10),
                organizationId: auth.organizationId,
            },
            include: {
                holidays: true,
            },
        });

        return NextResponse.json(holidayList);
    } catch (error) {
        console.error("CREATE_HOLIDAY_LIST_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
