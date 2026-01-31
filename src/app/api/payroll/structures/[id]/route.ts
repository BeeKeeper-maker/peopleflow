import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const structureSchema = z.object({
    name: z.string().min(1, "Name is required"),
    basicPercentage: z.number().min(0).max(100),
    houseRentPercent: z.number().min(0).max(100),
    medicalPercent: z.number().min(0).max(100),
    conveyanceFixed: z.number().min(0),
    pfEmployeePercent: z.number().min(0).max(100),
    pfEmployerPercent: z.number().min(0).max(100),
    description: z.string().optional(),
});

export async function PUT(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id } = params;
        const body = await req.json();
        const validation = structureSchema.safeParse(body);

        if (!validation.success) {
            return new NextResponse(validation.error.issues[0].message, { status: 400 });
        }

        const structure = await prisma.salaryStructure.update({
            where: { id },
            data: validation.data,
        });

        return NextResponse.json(structure);
    } catch (error) {
        console.error("SALARY_STRUCTURE_PUT_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id } = params;

        // Check if assigned to any employees
        const assignmentCount = await prisma.salaryStructureAssignment.count({
            where: { salaryStructureId: id },
        });

        if (assignmentCount > 0) {
            return new NextResponse(
                "Cannot delete structure as it is assigned to employees. Remove assignments first.",
                { status: 400 }
            );
        }

        await prisma.salaryStructure.delete({
            where: { id },
        });

        return new NextResponse(null, { status: 200 });
    } catch (error) {
        console.error("SALARY_STRUCTURE_DELETE_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
