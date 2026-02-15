import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { employeeSchema } from "@/lib/validations/employee";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;

        const employee = await prisma.employee.findUnique({
            where: {
                id,
                organizationId: user.organizationId,
            },
            include: {
                department: true,
                designation: true,
                reportingManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                },
                salaryAssignments: {
                    include: {
                        salaryStructure: true,
                    },
                    orderBy: {
                        effectiveFrom: 'desc',
                    },
                    take: 1,
                },
            },
        });

        if (!employee) {
            return new NextResponse("Employee not found", { status: 404 });
        }

        return NextResponse.json(employee);
    } catch (error) {
        console.error("GET_EMPLOYEE_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require HR admin role for editing employees
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const { id } = await params;
        const json = await req.json();
        const body = employeeSchema.parse(json);

        // Check if employee exists
        const existingEmployee = await prisma.employee.findUnique({
            where: { id, organizationId: auth.organizationId },
            include: {
                salaryAssignments: {
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1
                }
            }
        });

        if (!existingEmployee) {
            return new NextResponse("Employee not found", { status: 404 });
        }

        // Destructure ALL non-Prisma fields out of body
        const {
            grossSalary,
            bankAccount,
            salaryStructureId,
            emergencyContactName: _ecName,
            emergencyContactPhone: _ecPhone,
            emergencyContactRelation: _ecRel,
            ...employeeData
        } = body as Record<string, unknown>;

        // Map bankAccount to accountNumber for Prisma (allow clearing with empty string)
        if (bankAccount !== undefined) {
            (employeeData as Record<string, unknown>).accountNumber = bankAccount || null;
        }

        const organizationId = auth.organizationId;

        const result = await prisma.$transaction(async (tx) => {
            // Update Employee Record
            const updatedEmployee = await tx.employee.update({
                where: { id },
                data: employeeData as any,
            });

            // Handle Salary Update
            const currentSalary = existingEmployee.salaryAssignments[0];

            if (!currentSalary || currentSalary.grossSalary !== grossSalary ||
                (salaryStructureId && currentSalary.salaryStructureId !== salaryStructureId)) {

                // Determine which salary structure to use
                const structureId = (salaryStructureId as string) || currentSalary?.salaryStructureId;

                if (currentSalary) {
                    const today = new Date();
                    const isToday = currentSalary.effectiveFrom.toDateString() === today.toDateString();

                    if (isToday) {
                        await tx.salaryStructureAssignment.update({
                            where: { id: currentSalary.id },
                            data: {
                                grossSalary: grossSalary as number,
                                ...(salaryStructureId ? { salaryStructureId: salaryStructureId as string } : {}),
                            }
                        });
                    } else {
                        // Deactivate old assignment
                        await tx.salaryStructureAssignment.update({
                            where: { id: currentSalary.id },
                            data: { isActive: false }
                        });

                        // Create new assignment with history
                        await tx.salaryStructureAssignment.create({
                            data: {
                                employeeId: id,
                                salaryStructureId: structureId || currentSalary.salaryStructureId,
                                grossSalary: grossSalary as number,
                                effectiveFrom: new Date(),
                            }
                        });
                    }
                } else {
                    // No previous assignment, create new
                    let targetStructureId = salaryStructureId as string;
                    if (!targetStructureId) {
                        const defaultStructure = await tx.salaryStructure.findFirst({
                            where: { organizationId }
                        });
                        targetStructureId = defaultStructure?.id || '';
                    }

                    if (targetStructureId) {
                        await tx.salaryStructureAssignment.create({
                            data: {
                                employeeId: id,
                                salaryStructureId: targetStructureId,
                                grossSalary: grossSalary as number,
                                effectiveFrom: new Date(),
                            }
                        });
                    }
                }
            }

            return updatedEmployee;
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error("UPDATE_EMPLOYEE_ERROR", error);
        return new NextResponse(error instanceof Error ? error.message : "Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Require HR admin role for deleting employees
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const { id } = await params;

        const employee = await prisma.employee.findUnique({
            where: { id, organizationId: auth.organizationId }
        });

        if (!employee) {
            return new NextResponse("Employee not found", { status: 404 });
        }

        // Soft delete
        await prisma.employee.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                employmentStatus: "terminated"
            }
        });

        return new NextResponse(null, { status: 204 });

    } catch (error) {
        console.error("DELETE_EMPLOYEE_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
