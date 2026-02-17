import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

// POST /api/holidays/[id] — Add holiday(s) to a list
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;

        // Verify the holiday list belongs to this org
        const holidayList = await prisma.holidayList.findFirst({
            where: {
                id,
                organizationId: auth.organizationId,
            },
        });

        if (!holidayList) {
            return NextResponse.json(
                { error: "Holiday list not found" },
                { status: 404 }
            );
        }

        const json = await req.json();

        // Handle bulk import
        if (json.bulk && Array.isArray(json.bulk)) {
            const holidays = await prisma.holiday.createMany({
                data: json.bulk.map((h: { name: string; nameBn?: string; date: string; type?: string; description?: string }) => ({
                    name: h.name,
                    nameBn: h.nameBn || null,
                    date: new Date(h.date),
                    description: h.type || h.description || null,
                    holidayListId: id,
                })),
            });

            return NextResponse.json({ count: holidays.count });
        }

        // Single holiday creation
        const { name, nameBn, date, type, description } = json;

        if (!name || !date) {
            return NextResponse.json(
                { error: "Name and date are required" },
                { status: 400 }
            );
        }

        const holiday = await prisma.holiday.create({
            data: {
                name,
                nameBn: nameBn || null,
                date: new Date(date),
                description: type || description || null,
                holidayListId: id,
            },
        });

        return NextResponse.json(holiday);
    } catch (error) {
        console.error("ADD_HOLIDAY_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// PUT /api/holidays/[id] — Update a holiday list or a holiday
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;
        const json = await req.json();

        // If holidayId is present, update a specific holiday
        if (json.holidayId) {
            const holiday = await prisma.holiday.update({
                where: { id: json.holidayId },
                data: {
                    name: json.name,
                    nameBn: json.nameBn || null,
                    date: json.date ? new Date(json.date) : undefined,
                    description: json.type || json.description || null,
                },
            });
            return NextResponse.json(holiday);
        }

        // Otherwise update the holiday list itself
        const holidayList = await prisma.holidayList.update({
            where: { id },
            data: {
                name: json.name,
                isActive: json.isActive,
            },
        });

        return NextResponse.json(holidayList);
    } catch (error) {
        console.error("UPDATE_HOLIDAY_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// DELETE /api/holidays/[id] — Delete a holiday or holiday list
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const holidayId = searchParams.get("holidayId");

        if (holidayId) {
            // Delete a specific holiday
            await prisma.holiday.delete({
                where: { id: holidayId },
            });
            return NextResponse.json({ success: true });
        }

        // Delete the entire holiday list (cascade deletes holidays)
        // First verify it belongs to this org
        const holidayList = await prisma.holidayList.findFirst({
            where: {
                id,
                organizationId: auth.organizationId,
            },
        });

        if (!holidayList) {
            return NextResponse.json(
                { error: "Holiday list not found" },
                { status: 404 }
            );
        }

        await prisma.holidayList.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE_HOLIDAY_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
