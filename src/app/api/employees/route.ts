import { NextResponse } from "next/server";
import {
  employeeSchema,
  toPrismaEmployeeData,
  buildEmergencyContactJson,
} from "@/lib/validations/employee";
import { z } from "zod";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { enforcePlanLimit, onResourceCreated } from "@/lib/plan-enforcement";
import { sendTemplateEmail } from "@/lib/email";
import { apiLogger } from "@/lib/logger";
import { randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employees — Create Employee
// ─────────────────────────────────────────────────────────────────────────────

function calculateProratedLeaveDays(
  annualAllocation: number,
  joiningDate: Date,
  year: number,
  proRataEnabled: boolean,
) {
  if (!proRataEnabled) return annualAllocation;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  if (joiningDate <= yearStart) return annualAllocation;
  if (joiningDate > yearEnd) return 0;

  const remainingMonthsInclusive = 12 - joiningDate.getMonth();
  const prorated = (annualAllocation * remainingMonthsInclusive) / 12;
  return Math.round(prorated * 2) / 2;
}

export async function POST(req: Request) {
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) return auth;

  try {
    const json = await req.json();
    const body = employeeSchema.parse(json);

    const planCheck = await enforcePlanLimit(auth.organizationId, "employee");
    if (!planCheck.allowed) {
      return NextResponse.json(
        {
          error: planCheck.message,
          code: planCheck.code,
          title: planCheck.title,
          action: planCheck.action,
          upgradeRequired: planCheck.upgradeRequired,
          current: planCheck.current,
          limit: planCheck.limit,
        },
        { status: 402 },
      );
    }

    const normalizedEmail = body.email?.toLowerCase();
    const prismaData = toPrismaEmployeeData(body);
    const emergencyContact = buildEmergencyContactJson(body);

    const transaction = await auth.withDB(async (tx) => {
      // ── Uniqueness Checks ────────────────────────────────────────────
      const existingCode = await tx.employee.findFirst({
        where: {
          organizationId: auth.organizationId,
          employeeCode: body.employeeCode,
        },
      });
      if (existingCode) {
        return {
          response: NextResponse.json(
            { error: "Employee code already exists" },
            { status: 409 },
          ),
        };
      }

      if (normalizedEmail) {
        const existingEmail = await tx.employee.findFirst({
          where: {
            organizationId: auth.organizationId,
            email: normalizedEmail,
          },
        });
        if (existingEmail) {
          return {
            response: NextResponse.json(
              { error: "Email already exists" },
              { status: 409 },
            ),
          };
        }

        const existingUser = await tx.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });
        if (existingUser) {
          return {
            response: NextResponse.json(
              { error: "A user account already exists for this email" },
              { status: 409 },
            ),
          };
        }
      }

      // ── Foreign Key Existence Validation (CRIT-07) ───────────────────
      const department = await tx.department.findUnique({
        where: { id: body.departmentId },
      });
      if (!department || department.organizationId !== auth.organizationId) {
        return {
          response: NextResponse.json(
            { error: "Invalid department selected" },
            { status: 400 },
          ),
        };
      }

      const designation = await tx.designation.findUnique({
        where: { id: body.designationId },
      });
      if (!designation || designation.organizationId !== auth.organizationId) {
        return {
          response: NextResponse.json(
            { error: "Invalid designation selected" },
            { status: 400 },
          ),
        };
      }

      if (body.shiftId) {
        const shift = await tx.shift.findUnique({
          where: { id: body.shiftId },
        });
        if (!shift || shift.organizationId !== auth.organizationId) {
          return {
            response: NextResponse.json(
              { error: "Invalid shift selected" },
              { status: 400 },
            ),
          };
        }
      }

      if (body.reportingManagerId) {
        const manager = await tx.employee.findUnique({
          where: { id: body.reportingManagerId },
        });
        if (!manager || manager.organizationId !== auth.organizationId) {
          return {
            response: NextResponse.json(
              { error: "Invalid reporting manager selected" },
              { status: 400 },
            ),
          };
        }
      }

      // ── Salary Structure Resolution (ARCH-10 — org-scoped) ──────────
      let salaryStructure = body.salaryStructureId
        ? await tx.salaryStructure.findUnique({
            where: { id: body.salaryStructureId },
          })
        : null;
      if (
        salaryStructure &&
        salaryStructure.organizationId !== auth.organizationId
      ) {
        salaryStructure = null;
      }
      if (!salaryStructure) {
        salaryStructure = await tx.salaryStructure.findFirst({
          where: { organizationId: auth.organizationId, isActive: true },
        });
      }
      if (!salaryStructure) {
        return {
          response: NextResponse.json(
            {
              error:
                "No active salary structure found. Please configure payroll settings first.",
            },
            { status: 400 },
          ),
        };
      }

      const defaultBranch = await tx.branch.findFirst({
        where: { organizationId: auth.organizationId, isActive: true },
        orderBy: [{ isHeadOffice: "desc" }, { createdAt: "asc" }],
        select: { id: true },
      });

      const user = normalizedEmail
        ? await tx.user.create({
            data: {
              email: normalizedEmail,
              name: `${body.firstName} ${body.lastName}`,
              password: null,
              role: "employee",
              organizationId: auth.organizationId,
              isActive: true,
              emailVerified: null,
            },
          })
        : null;

      const employee = await tx.employee.create({
        data: {
          ...prismaData,
          email: normalizedEmail ?? null,
          emergencyContact,
          organizationId: auth.organizationId,
          userId: user?.id,
          branchId: defaultBranch?.id,
        },
      });

      await tx.salaryStructureAssignment.create({
        data: {
          employeeId: employee.id,
          salaryStructureId: salaryStructure.id,
          grossSalary: body.grossSalary,
          effectiveFrom: new Date(),
        },
      });

      const allocationYear = new Date().getFullYear();
      const leaveTypes = await tx.leaveType.findMany({
        where: {
          organizationId: auth.organizationId,
          isActive: true,
          annualAllocation: { gt: 0 },
        },
      });
      let leaveAllocationsCreated = 0;
      for (const leaveType of leaveTypes) {
        if (
          leaveType.applicableGender &&
          leaveType.applicableGender !== "all"
        ) {
          if (
            !body.gender ||
            body.gender.toLowerCase() !==
              leaveType.applicableGender.toLowerCase()
          ) {
            continue;
          }
        }

        if (leaveType.minServiceDays) {
          const serviceDays = Math.floor(
            (Date.now() - new Date(body.joiningDate).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (serviceDays < leaveType.minServiceDays) continue;
        }

        const allocatedDays = calculateProratedLeaveDays(
          leaveType.annualAllocation,
          new Date(body.joiningDate),
          allocationYear,
          leaveType.proRataEnabled,
        );
        if (allocatedDays <= 0) continue;

        await tx.leaveAllocation.create({
          data: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: allocationYear,
            allocatedDays,
            usedDays: 0,
            carriedForward: 0,
          },
        });
        leaveAllocationsCreated++;
      }

      let invitationToken: string | null = null;
      if (normalizedEmail) {
        invitationToken = randomBytes(32).toString("hex");
        await tx.passwordResetToken.create({
          data: {
            email: normalizedEmail,
            token: invitationToken,
            purpose: "employee_invitation",
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
          },
        });
      }

      return { result: { employee, invitationToken, leaveAllocationsCreated } };
    });

    if ("response" in transaction) return transaction.response;
    const { result } = transaction;

    if (normalizedEmail && result.invitationToken) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      void sendTemplateEmail(normalizedEmail, "employeeInvitation", {
        userName: `${body.firstName} ${body.lastName}`.trim(),
        setupUrl: `${appUrl}/set-password/${result.invitationToken}`,
        expiresIn: "24 hours",
      }).catch((err) =>
        apiLogger.error(
          { err, employeeId: result.employee.id },
          "EMPLOYEE_INVITE_EMAIL_FAILED",
        ),
      );
    }

    await onResourceCreated(auth.organizationId, "employee");

    return NextResponse.json({
      ...result.employee,
      onboardingInvitationSent: !!result.invitationToken,
      leaveAllocationsCreated: result.leaveAllocationsCreated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 422 },
      );
    }
    apiLogger.error({ err: error }, "CREATE_EMPLOYEE_ERROR");
    return NextResponse.json(
      { error: (error as Error).message || "Internal Error" },
      { status: 500 },
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

    const [employees, total] = await auth.withDB((db) =>
      Promise.all([
        db.employee.findMany({
          where,
          include: {
            department: true,
            designation: true,
          },
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        db.employee.count({ where }),
      ]),
    );

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
    apiLogger.error({ err: error }, "GET_EMPLOYEES_ERROR");
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
