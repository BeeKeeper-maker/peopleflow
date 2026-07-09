import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import * as z from "zod";
import { payrollLogger } from "@/lib/logger";

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
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get("employeeId");
        const activeOnly = searchParams.get("active") === "true";

        const where: any = {
            employee: {
                organizationId: auth.organizationId,
            },
        };

        if (employeeId) {
            where.employeeId = employeeId;
        }

        if (activeOnly) {
            where.isActive = true;
        }

        const assignments = await auth.withDB((db) => db.salaryStructureAssignment.findMany({
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
        }));

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
        payrollLogger.error({ err: error }, "GET_ASSIGNMENTS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST - Create new salary assignment
export async function POST(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const body = await req.json();
        const validation = assignmentSchema.safeParse(body);

        if (!validation.success) {
            return new NextResponse(validation.error.issues[0].message, { status: 400 });
        }

        const { employeeId, salaryStructureId, grossSalary, effectiveFrom, effectiveTo } = validation.data;

        // Verify employee belongs to organization
        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: { id: employeeId, organizationId: auth.organizationId },
        }));

        if (!employee) {
            return new NextResponse("Employee not found", { status: 404 });
        }

        // Verify salary structure belongs to organization
        const structure = await auth.withDB((db) => db.salaryStructure.findFirst({
            where: { id: salaryStructureId, organizationId: auth.organizationId },
        }));

        if (!structure) {
            return new NextResponse("Salary structure not found", { status: 404 });
        }

        // Deactivate previous active assignments for this employee
        await auth.withDB((db) => db.salaryStructureAssignment.updateMany({
            where: {
                employeeId,
                isActive: true,
            },
            data: {
                isActive: false,
                effectiveTo: new Date(effectiveFrom.getTime() - 86400000), // Previous day
            },
        }));

        // Create new assignment
        const assignment = await auth.withDB((db) => db.salaryStructureAssignment.create({
            data: {
                employeeId,
                organizationId: auth.organizationId,
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
        }));

        return NextResponse.json(assignment);
    } catch (error) {
        payrollLogger.error({ err: error }, "CREATE_ASSIGNMENT_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
