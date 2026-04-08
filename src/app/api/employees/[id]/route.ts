import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { employeeSchema, toPrismaEmployeeData, buildEmergencyContactJson } from "@/lib/validations/employee";
import { z } from "zod";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees/:id
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
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
                shift: true,
                branch: true,
                reportingManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeCode: true,
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
        apiLogger.error({ err: error }, "GET_EMPLOYEE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/employees/:id — Update Employee (CRIT-09, CRIT-10, CRIT-11 fixed)
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;
        const json = await req.json();

        // Parse with shared schema — returns 422 with details, not 500 (CRIT-09)
        let body;
        try {
            body = employeeSchema.parse(json);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return NextResponse.json(
                    { error: "Validation failed", details: error.issues },
                    { status: 422 }
                );
            }
            throw error;
        }

        // ── Verify employee exists ──────────────────────────────────────
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
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        // ── FK Existence Validation (CRIT-07, CRIT-08) ─────────────────
        const department = await prisma.department.findUnique({ where: { id: body.departmentId } });
        if (!department || department.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Invalid department selected" }, { status: 400 });
        }

        const designation = await prisma.designation.findUnique({ where: { id: body.designationId } });
        if (!designation || designation.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Invalid designation selected" }, { status: 400 });
        }

        if (body.shiftId) {
            const shift = await prisma.shift.findUnique({ where: { id: body.shiftId } });
            if (!shift || shift.organizationId !== auth.organizationId) {
                return NextResponse.json({ error: "Invalid shift selected" }, { status: 400 });
            }
        }

        if (body.reportingManagerId) {
            if (body.reportingManagerId === id) {
                return NextResponse.json({ error: "Employee cannot report to themselves" }, { status: 400 });
            }
            const manager = await prisma.employee.findUnique({ where: { id: body.reportingManagerId } });
            if (!manager || manager.organizationId !== auth.organizationId) {
                return NextResponse.json({ error: "Invalid reporting manager selected" }, { status: 400 });
            }
        }

        // ── Type-safe Prisma data (CRIT-10) ─────────────────────────────
        const prismaData = toPrismaEmployeeData(body);
        const emergencyContact = buildEmergencyContactJson(body);

        const organizationId = auth.organizationId;
        const { grossSalary, salaryStructureId } = body;

        const result = await prisma.$transaction(async (tx) => {
            const updatedEmployee = await tx.employee.update({
                where: { id },
                data: {
                    ...prismaData,
                    emergencyContact,
                },
            });

            // ── Salary Update Logic ─────────────────────────────────────
            const currentSalary = existingEmployee.salaryAssignments[0];

            if (!currentSalary || currentSalary.grossSalary !== grossSalary ||
                (salaryStructureId && currentSalary.salaryStructureId !== salaryStructureId)) {

                const structureId = salaryStructureId || currentSalary?.salaryStructureId;

                if (currentSalary) {
                    const today = new Date();
                    const isToday = currentSalary.effectiveFrom.toDateString() === today.toDateString();

                    if (isToday) {
                        await tx.salaryStructureAssignment.update({
                            where: { id: currentSalary.id },
                            data: {
                                grossSalary: grossSalary,
                                ...(salaryStructureId ? { salaryStructureId } : {}),
                            }
                        });
                    } else {
                        await tx.salaryStructureAssignment.update({
                            where: { id: currentSalary.id },
                            data: { isActive: false }
                        });

                        await tx.salaryStructureAssignment.create({
                            data: {
                                employeeId: id,
                                salaryStructureId: structureId || currentSalary.salaryStructureId,
                                grossSalary: grossSalary,
                                effectiveFrom: new Date(),
                            }
                        });
                    }
                } else {
                    let targetStructureId = salaryStructureId;
                    if (!targetStructureId) {
                        const defaultStructure = await tx.salaryStructure.findFirst({
                            where: { organizationId }
                        });
                        targetStructureId = defaultStructure?.id;
                    }

                    if (targetStructureId) {
                        await tx.salaryStructureAssignment.create({
                            data: {
                                employeeId: id,
                                salaryStructureId: targetStructureId,
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
        apiLogger.error({ err: error }, "UPDATE_EMPLOYEE_ERROR");
        return NextResponse.json(
            { error: (error as Error).message || "Internal Error" },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/employees/:id — Soft Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;

        const employee = await prisma.employee.findUnique({
            where: { id, organizationId: auth.organizationId }
        });

        if (!employee) {
            return new NextResponse("Employee not found", { status: 404 });
        }

        await prisma.$transaction(async (tx) => {
            // Soft delete employee
            await tx.employee.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    employmentStatus: "terminated"
                }
            });

            // Deactivate salary assignments (ARCH-08)
            await tx.salaryStructureAssignment.updateMany({
                where: { employeeId: id, isActive: true },
                data: { isActive: false }
            });
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_EMPLOYEE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
