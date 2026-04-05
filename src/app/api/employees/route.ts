import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { employeeSchema, toPrismaEmployeeData, buildEmergencyContactJson } from "@/lib/validations/employee";
import { z } from "zod";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employees — Create Employee
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const json = await req.json();
        const body = employeeSchema.parse(json);

        // ── Uniqueness Checks ────────────────────────────────────────────
        const existingCode = await prisma.employee.findFirst({
            where: { organizationId: auth.organizationId, employeeCode: body.employeeCode },
        });
        if (existingCode) {
            return NextResponse.json({ error: "Employee code already exists" }, { status: 409 });
        }

        if (body.email) {
            const existingEmail = await prisma.employee.findFirst({
                where: { organizationId: auth.organizationId, email: body.email },
            });
            if (existingEmail) {
                return NextResponse.json({ error: "Email already exists" }, { status: 409 });
            }
        }

        // ── Foreign Key Existence Validation (CRIT-07) ───────────────────
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
            const manager = await prisma.employee.findUnique({ where: { id: body.reportingManagerId } });
            if (!manager || manager.organizationId !== auth.organizationId) {
                return NextResponse.json({ error: "Invalid reporting manager selected" }, { status: 400 });
            }
        }

        // ── Salary Structure Resolution (ARCH-10 — org-scoped) ──────────
        let salaryStructure;
        if (body.salaryStructureId) {
            salaryStructure = await prisma.salaryStructure.findUnique({
                where: { id: body.salaryStructureId },
            });
            // Reject if it belongs to a different org
            if (salaryStructure && salaryStructure.organizationId !== auth.organizationId) {
                salaryStructure = null;
            }
        }
        if (!salaryStructure) {
            salaryStructure = await prisma.salaryStructure.findFirst({
                where: { organizationId: auth.organizationId, isActive: true },
            });
        }
        if (!salaryStructure) {
            return NextResponse.json(
                { error: "No active salary structure found. Please configure payroll settings first." },
                { status: 400 }
            );
        }

        // ── Type-Safe Prisma Data (CRIT-10 — no more `as any`) ──────────
        const prismaData = toPrismaEmployeeData(body);
        const emergencyContact = buildEmergencyContactJson(body);

        const result = await prisma.$transaction(async (tx) => {
            const employee = await tx.employee.create({
                data: {
                    ...prismaData,
                    emergencyContact,
                    organizationId: auth.organizationId,
                },
            });

            await tx.salaryStructureAssignment.create({
                data: {
                    employeeId: employee.id,
                    salaryStructureId: salaryStructure!.id,
                    grossSalary: body.grossSalary,
                    effectiveFrom: new Date(),
                },
            });

            return employee;
        });

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation failed", details: error.issues },
                { status: 422 }
            );
        }
        console.error("CREATE_EMPLOYEE_ERROR", error);
        return NextResponse.json(
            { error: (error as Error).message || "Internal Error" },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees — List Employees
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
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
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { employeeCode: { contains: search, mode: "insensitive" } },
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
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
