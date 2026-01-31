import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const shiftSchema = z.object({
    name: z.string().min(1, "Name is required"),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid logic format (HH:mm)"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid logic format (HH:mm)"),
    breakDuration: z.number().min(0).default(60),
    graceMinutes: z.number().min(0).default(15),
    halfDayHours: z.number().min(0).default(4),
    fullDayHours: z.number().min(0).default(8),
    isDefault: z.boolean().default(false),
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const json = await req.json();
        const body = shiftSchema.parse(json);

        // If setting as default, unset others
        if (body.isDefault) {
            await prisma.shift.updateMany({
                where: { organizationId: user.organizationId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const shift = await prisma.shift.create({
            data: {
                ...body,
                organizationId: user.organizationId,
            }
        });

        return NextResponse.json(shift);

    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.issues), { status: 422 });
        }
        console.error("CREATE_SHIFT_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const shifts = await prisma.shift.findMany({
            where: { organizationId: user.organizationId, isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(shifts);

    } catch (error) {
        console.error("GET_SHIFTS_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
