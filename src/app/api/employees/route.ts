import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { employeeSchema } from "@/lib/validations/employee";
import { z } from "zod";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";

export async function POST(req: Request) {
    // Require HR admin role for creating employees
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) {
        return auth;
    }

    try {
        const json = await req.json();
        const body = employeeSchema.parse(json);

        // Check if employee code exists
        const existingCode = await prisma.employee.findFirst({
            where: {
                organizationId: auth.organizationId,
                employeeCode: body.employeeCode,
            },
        });

        if (existingCode) {
            return new NextResponse("Employee code already exists", { status: 409 });
        }

        // Check if email exists (only if email provided)
        if (body.email) {
            const existingEmail = await prisma.employee.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    email: body.email,
                },
            });

            if (existingEmail) {
                return new NextResponse("Email already exists", { status: 409 });
            }
        }

        // Get salary structure - use provided ID or fall back to default
        let salaryStructure;
        if (body.salaryStructureId) {
            salaryStructure = await prisma.salaryStructure.findUnique({
                where: { id: body.salaryStructureId },
            });
        }
        if (!salaryStructure) {
            salaryStructure = await prisma.salaryStructure.findFirst({
                where: { organizationId: auth.organizationId },
            });
        }

        if (!salaryStructure) {
            return new NextResponse("No active salary structure found. Please configure payroll settings first.", { status: 400 });
        }

        // Destructure non-Prisma fields out of body
        const {
            grossSalary,
            salaryStructureId: _structId,
            bankAccount,
            emergencyContactName: _ecName,
            emergencyContactPhone: _ecPhone,
            emergencyContactRelation: _ecRel,
            ...employeeData
        } = body as Record<string, unknown>;

        // Map bankAccount to accountNumber for Prisma
        if (bankAccount !== undefined) {
            (employeeData as Record<string, unknown>).accountNumber = bankAccount || null;
        }

        const result = await prisma.$transaction(async (tx) => {
            const employee = await tx.employee.create({
                data: {
                    ...(employeeData as Record<string, unknown>),
                    organizationId: auth.organizationId,
                } as any,
            });

            // Create Salary Structure Assignment
            await tx.salaryStructureAssignment.create({
                data: {
                    employeeId: employee.id,
                    salaryStructureId: salaryStructure!.id,
                    grossSalary: grossSalary as number,
                    effectiveFrom: new Date(),
                }
            });

            return employee;
        });

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.issues), { status: 422 });
        }
        console.error("CREATE_EMPLOYEE_ERROR", error);
        return new NextResponse((error as Error).message, { status: 500 });
    }
}

export async function GET(req: Request) {
    // Require HR admin role for viewing all employees
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) {
        return auth;
    }

    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const departmentId = searchParams.get("departmentId");
        const status = searchParams.get("status");

        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {
            organizationId: auth.organizationId,
            deletedAt: null,
        };

        if (search) {
            where.OR = [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { employeeCode: { contains: search } },
            ];
        }

        if (departmentId) {
            where.departmentId = departmentId;
        }

        if (status) {
            where.employmentStatus = status;
        }

        const [employees, total] = await prisma.$transaction([
            prisma.employee.findMany({
                where,
                include: {
                    department: true,
                    designation: true,
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.employee.count({ where }),
        ]);

        return NextResponse.json({
            data: employees,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("GET_EMPLOYEES_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
