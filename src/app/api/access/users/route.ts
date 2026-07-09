import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

const roleSchema = z.enum(["admin", "hr_admin", "manager", "employee"]);

const updateSchema = z.object({
  userId: z.string().min(1),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

function isAdminRole(role: string) {
  return ["super_admin", "admin"].includes(role);
}

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) return auth;

  if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await auth.withDB((db) => db.user.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: [{ role: "asc" }, { name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
        twoFactorEnabled: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            employmentStatus: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
            reportingManager: {
              select: { id: true, firstName: true, lastName: true, employeeCode: true },
            },
            _count: { select: { reportees: true } },
          },
        },
      },
    }));

    const summary = {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      inactive: users.filter((u) => !u.isActive).length,
      admins: users.filter((u) => ["admin", "super_admin"].includes(u.role)).length,
      hrAdmins: users.filter((u) => u.role === "hr_admin").length,
      managers: users.filter((u) => u.role === "manager").length,
      employees: users.filter((u) => u.role === "employee").length,
      unlinked: users.filter((u) => !u.employee).length,
      managersWithoutReportees: users.filter((u) => u.role === "manager" && (u.employee?._count.reportees || 0) === 0).length,
      setupPending: users.filter((u) => u.isActive && !u.emailVerified).length,
    };

    return NextResponse.json({ data: users, summary });
  } catch (error) {
    apiLogger.error({ err: error }, "ACCESS_USERS_GET_ERROR");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) return auth;

  if (!isAdminRole(auth.role)) {
    return NextResponse.json({ error: "Only organization admins can change user access" }, { status: 403 });
  }

  try {
    const body = updateSchema.parse(await req.json());

    const target = await auth.withDB((db) => db.user.findFirst({
      where: { id: body.userId, organizationId: auth.organizationId },
      select: { id: true, role: true, isActive: true, employee: { select: { id: true } } },
    }));

    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.id === auth.userId && body.isActive === false) {
      return NextResponse.json({ error: "You cannot deactivate your own login" }, { status: 400 });
    }

    const adminCount = await auth.withDB((db) => db.user.count({
      where: { organizationId: auth.organizationId, role: { in: ["admin", "super_admin"] }, isActive: true },
    }));

    const wouldRemoveAdmin = ["admin", "super_admin"].includes(target.role) &&
      target.isActive &&
      (body.isActive === false || (body.role !== undefined && !["admin"].includes(body.role)));

    if (wouldRemoveAdmin && adminCount <= 1) {
      return NextResponse.json({ error: "At least one active admin must remain" }, { status: 400 });
    }

    if (body.role === "manager" && !target.employee) {
      return NextResponse.json({ error: "Manager role requires a linked employee profile" }, { status: 400 });
    }

    const updated = await auth.withDB((db) => db.user.update({
      where: { id: target.id },
      data: {
        ...(body.role !== undefined && { role: body.role }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        // Always invalidate sessions when role changes or user is deactivated.
        // A role change (e.g., admin → employee) must immediately revoke any
        // elevated-privilege session; otherwise the demoted user retains
        // admin access until their JWT expires or is refreshed.
        ...((body.role !== undefined || body.isActive === false) && {
          sessionVersion: { increment: 1 },
        }),
      },
      select: { id: true, role: true, isActive: true },
    }));

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    apiLogger.error({ err: error }, "ACCESS_USERS_PATCH_ERROR");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
