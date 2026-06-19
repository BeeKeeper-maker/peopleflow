import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { employeeSchema, toPrismaEmployeeData, buildEmergencyContactJson } from "@/lib/validations/employee";
import { z } from "zod";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { sendTemplateEmail } from "@/lib/email";
import { randomBytes } from "crypto";

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
            select: { id: true, organizationId: true, role: true, employee: { select: { id: true } } },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const { id } = await params;
        const userRole = user.role as string;
        const isHRLevel = ["super_admin", "admin", "hr_admin"].includes(userRole);
        const isManager = userRole === "manager";
        const isSelf = user.employee?.id === id;
        const isDirectReport = isManager && !!user.employee?.id && await prisma.employee.findFirst({
            where: {
                id,
                organizationId: user.organizationId,
                reportingManagerId: user.employee.id,
                deletedAt: null,
            },
            select: { id: true },
        });

        // Full profile data for HR; non-HR self/manager views exclude salary assignment data.
        if (isHRLevel || isDirectReport || isSelf) {
            const employee = await prisma.employee.findFirst({
                where: {
                    id,
                    organizationId: user.organizationId,
                    deletedAt: null,
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
                    ...(isHRLevel ? {
                        salaryAssignments: {
                            where: { isActive: true },
                            include: {
                                salaryStructure: true,
                            },
                            orderBy: {
                                effectiveFrom: 'desc' as const,
                            },
                            take: 1,
                        },
                    } : {}),
                },
            });

            if (!employee) {
                return new NextResponse("Employee not found", { status: 404 });
            }

            return NextResponse.json(employee);
        }

        // Regular employees viewing others: public fields only (no salary, NID, bank details)
        const employee = await prisma.employee.findFirst({
            where: {
                id,
                organizationId: user.organizationId,
                deletedAt: null,
            },
            select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                photoUrl: true,
                gender: true,
                joiningDate: true,
                employmentType: true,
                employmentStatus: true,
                department: { select: { id: true, name: true, code: true } },
                designation: { select: { id: true, name: true, grade: true } },
                branch: { select: { id: true, name: true } },
                shift: { select: { id: true, name: true, startTime: true, endTime: true } },
                reportingManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                    }
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
                    where: { isActive: true },
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1
                }
            }
        });

        if (!existingEmployee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        const normalizedEmail = body.email?.toLowerCase();
        if (normalizedEmail) {
            body.email = normalizedEmail;

            const duplicateEmployee = await prisma.employee.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    email: normalizedEmail,
                    NOT: { id },
                },
                select: { id: true },
            });
            if (duplicateEmployee) {
                return NextResponse.json({ error: "Email already exists" }, { status: 409 });
            }

            const duplicateUser = await prisma.user.findUnique({
                where: { email: normalizedEmail },
                select: { id: true },
            });
            if (duplicateUser && duplicateUser.id !== existingEmployee.userId) {
                return NextResponse.json({ error: "A user account already exists for this email" }, { status: 409 });
            }
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
            const wasInactive = existingEmployee.employmentStatus !== "active" || !!existingEmployee.deletedAt;
            const isActiveEmployment = body.employmentStatus === "active";
            const isReactivation = isActiveEmployment && wasInactive;

            const updatedEmployee = await tx.employee.update({
                where: { id },
                data: {
                    ...prismaData,
                    emergencyContact,
                    ...(isActiveEmployment ? { deletedAt: null } : {}),
                },
            });

            let reactivationToken: string | null = null;
            const linkedUserId = existingEmployee.userId;
            if (linkedUserId) {
                const userEmail = normalizedEmail || existingEmployee.email;
                await tx.user.update({
                    where: { id: linkedUserId },
                    data: {
                        name: `${body.firstName} ${body.lastName}`.trim(),
                        ...(normalizedEmail ? { email: normalizedEmail } : {}),
                        isActive: isActiveEmployment,
                        ...(!isActiveEmployment || isReactivation ? { password: null, emailVerified: null } : {}),
                    },
                });

                if (!isActiveEmployment || isReactivation) {
                    await tx.session.deleteMany({ where: { userId: linkedUserId } });
                }

                if (isReactivation && userEmail) {
                    await tx.passwordResetToken.deleteMany({ where: { email: userEmail, used: false } });
                    reactivationToken = randomBytes(32).toString("hex");
                    await tx.passwordResetToken.create({
                        data: {
                            email: userEmail,
                            token: reactivationToken,
                            purpose: "employee_reactivation",
                            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
                        },
                    });
                }
            }

            // ── Deferred Compensation Update Logic ─────────────────────
            // No active salary assignment means compensation is intentionally deferred.
            // Payroll, payslips, PF, bonus, and salary documents already depend on an
            // active assignment, so onboarding can stay clean without fake salary data.
            const currentSalary = existingEmployee.salaryAssignments[0];
            const shouldHaveActiveCompensation = grossSalary > 0;

            if (!shouldHaveActiveCompensation) {
                if (currentSalary?.isActive) {
                    await tx.salaryStructureAssignment.update({
                        where: { id: currentSalary.id },
                        data: { isActive: false }
                    });
                }
            } else if (!currentSalary || currentSalary.grossSalary !== grossSalary ||
                (salaryStructureId && currentSalary.salaryStructureId !== salaryStructureId) ||
                !currentSalary.isActive) {

                let structureId: string | undefined = salaryStructureId || currentSalary?.salaryStructureId;
                if (!structureId) {
                    const defaultStructure = await tx.salaryStructure.findFirst({
                        where: { organizationId, isActive: true }
                    });
                    structureId = defaultStructure?.id;
                }

                if (!structureId) {
                    throw new Error("No active salary structure found. Save without salary, or configure payroll settings before assigning compensation.");
                }

                if (currentSalary) {
                    const today = new Date();
                    const isToday = currentSalary.effectiveFrom.toDateString() === today.toDateString();

                    if (isToday) {
                        await tx.salaryStructureAssignment.update({
                            where: { id: currentSalary.id },
                            data: {
                                grossSalary,
                                salaryStructureId: structureId,
                                isActive: true,
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
                                salaryStructureId: structureId,
                                grossSalary,
                                effectiveFrom: new Date(),
                            }
                        });
                    }
                } else {
                    await tx.salaryStructureAssignment.create({
                        data: {
                            employeeId: id,
                            salaryStructureId: structureId,
                            grossSalary,
                            effectiveFrom: new Date(),
                        }
                    });
                }
            }

            return { updatedEmployee, reactivationToken };
        });

        if (result.reactivationToken && (normalizedEmail || existingEmployee.email)) {
            const targetEmail = normalizedEmail || existingEmployee.email!;
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
            void sendTemplateEmail(targetEmail, "employeeReactivation", {
                userName: `${body.firstName} ${body.lastName}`.trim(),
                setupUrl: `${appUrl}/set-password/${result.reactivationToken}`,
                expiresIn: "24 hours",
            }).catch((err) => apiLogger.error({ err, employeeId: id }, "EMPLOYEE_REACTIVATION_EMAIL_FAILED"));
        }

        return NextResponse.json({
            ...result.updatedEmployee,
            reactivationInvitationSent: !!result.reactivationToken,
        });
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
            where: { id, organizationId: auth.organizationId },
            select: { id: true, userId: true }
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

            // Deactivate linked ESS login and any DB-backed sessions
            if (employee.userId) {
                await tx.user.update({
                    where: { id: employee.userId },
                    data: { isActive: false, password: null, emailVerified: null },
                });
                await tx.session.deleteMany({ where: { userId: employee.userId } });
            }

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
