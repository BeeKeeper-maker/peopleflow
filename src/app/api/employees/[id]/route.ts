import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { employeeSchema } from "@/lib/validations/employee";

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
        const json = await req.json();
        const body = employeeSchema.parse(json);

        // Check if employee exists
        const existingEmployee = await prisma.employee.findUnique({
            where: { id, organizationId: user.organizationId },
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

        const { grossSalary, bankAccount, ...employeeData } = body;
        const organizationId = user.organizationId;

        const result = await prisma.$transaction(async (tx) => {
            // Update Employee Record
            const updatedEmployee = await tx.employee.update({
                where: { id },
                data: {
                    ...employeeData,
                    accountNumber: bankAccount,
                },
            });

            // Handle Salary Update
            // If gross salary is different from current, update assignment
            const currentSalary = existingEmployee.salaryAssignments[0];

            if (!currentSalary || currentSalary.grossSalary !== grossSalary) {
                if (currentSalary) {
                    // Logic: If current assignment effectiveFrom is today, update it.
                    // Otherwise create new one.
                    const today = new Date();
                    const isToday = currentSalary.effectiveFrom.toDateString() === today.toDateString();

                    if (isToday) {
                        await tx.salaryStructureAssignment.update({
                            where: { id: currentSalary.id },
                            data: { grossSalary }
                        });
                    } else {
                        // Close previous assignment? (Optional, schema has effectiveTo?)
                        // Assuming we just create new one for history
                        await tx.salaryStructureAssignment.create({
                            data: {
                                employeeId: id,
                                salaryStructureId: currentSalary.salaryStructureId,
                                grossSalary: grossSalary,
                                effectiveFrom: new Date(),
                            }
                        });
                    }
                } else {
                    // No previous assignment (weird but possible), create new
                    // Need salary structure ID. Fallback to default.
                    const defaultStructure = await tx.salaryStructure.findFirst({
                        where: { organizationId }
                    });

                    if (defaultStructure) {
                        await tx.salaryStructureAssignment.create({
                            data: {
                                employeeId: id,
                                salaryStructureId: defaultStructure.id,
                                grossSalary: grossSalary,
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
            where: { id, organizationId: user.organizationId }
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
