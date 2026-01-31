import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as z from "zod";

const assignmentSchema = z.object({
    employeeId: z.string().min(1, "Employee is required"),
    salaryStructureId: z.string().min(1, "Salary structure is required"),
    grossSalary: z.number().min(0, "Gross salary must be positive"),
    effectiveFrom: z.string().transform((val) => new Date(val)),
    effectiveTo: z.string().optional().transform((val) => val ? new Date(val) : null),
});

// GET - List all salary assignments
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

        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get("employeeId");
        const activeOnly = searchParams.get("active") === "true";

        const where: any = {
            employee: {
                organizationId: user.organizationId,
            },
        };

        if (employeeId) {
            where.employeeId = employeeId;
        }

        if (activeOnly) {
            where.isActive = true;
        }

        const assignments = await prisma.salaryStructureAssignment.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                        designation: { select: { name: true } },
                    },
                },
                salaryStructure: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        basicPercentage: true,
                        houseRentPercent: true,
                        medicalPercent: true,
                        conveyanceFixed: true,
                        pfEmployeePercent: true,
                        pfEmployerPercent: true,
                    },
                },
            },
            orderBy: { effectiveFrom: "desc" },
        });

        // Calculate salary breakdown for each assignment
        const assignmentsWithBreakdown = assignments.map((a) => {
            const gross = a.grossSalary;
            const structure = a.salaryStructure;

            const basic = (gross * structure.basicPercentage) / 100;
            const houseRent = (basic * structure.houseRentPercent) / 100;
            const medical = (basic * structure.medicalPercent) / 100;
            const conveyance = structure.conveyanceFixed;
            const pfEmployee = (basic * structure.pfEmployeePercent) / 100;
            const pfEmployer = (basic * structure.pfEmployerPercent) / 100;

            return {
                ...a,
                breakdown: {
                    basic: Math.round(basic),
                    houseRent: Math.round(houseRent),
                    medical: Math.round(medical),
                    conveyance: Math.round(conveyance),
                    totalEarnings: Math.round(basic + houseRent + medical + conveyance),
                    pfEmployee: Math.round(pfEmployee),
                    pfEmployer: Math.round(pfEmployer),
                    totalDeductions: Math.round(pfEmployee),
                    netSalary: Math.round(gross - pfEmployee),
                },
            };
        });

        return NextResponse.json(assignmentsWithBreakdown);
    } catch (error) {
        console.error("GET_ASSIGNMENTS_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST - Create new salary assignment
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

        const body = await req.json();
        const validation = assignmentSchema.safeParse(body);

        if (!validation.success) {
            return new NextResponse(validation.error.issues[0].message, { status: 400 });
        }

        const { employeeId, salaryStructureId, grossSalary, effectiveFrom, effectiveTo } = validation.data;

        // Verify employee belongs to organization
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, organizationId: user.organizationId },
        });

        if (!employee) {
            return new NextResponse("Employee not found", { status: 404 });
        }

        // Verify salary structure belongs to organization
        const structure = await prisma.salaryStructure.findFirst({
            where: { id: salaryStructureId, organizationId: user.organizationId },
        });

        if (!structure) {
            return new NextResponse("Salary structure not found", { status: 404 });
        }

        // Deactivate previous active assignments for this employee
        await prisma.salaryStructureAssignment.updateMany({
            where: {
                employeeId,
                isActive: true,
            },
            data: {
                isActive: false,
                effectiveTo: new Date(effectiveFrom.getTime() - 86400000), // Previous day
            },
        });

        // Create new assignment
        const assignment = await prisma.salaryStructureAssignment.create({
            data: {
                employeeId,
                salaryStructureId,
                grossSalary,
                effectiveFrom,
                effectiveTo: effectiveTo || null,
                isActive: true,
            },
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                salaryStructure: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json(assignment);
    } catch (error) {
        console.error("CREATE_ASSIGNMENT_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
