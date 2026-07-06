import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const [deptCount, desigCount, shiftCount, empCount] = await Promise.all([
            prisma.department.count({ where: { organizationId: auth.organizationId } }),
            prisma.designation.count({ where: { organizationId: auth.organizationId } }),
            prisma.shift.count({ where: { organizationId: auth.organizationId } }),
            prisma.employee.count({ where: { organizationId: auth.organizationId, deletedAt: null } }),
        ]);

        return NextResponse.json({
            hasDepartments: deptCount > 0,
            hasDesignations: desigCount > 0,
            hasShifts: shiftCount > 0,
            hasEmployees: empCount > 0,
            counts: { departments: deptCount, designations: desigCount, shifts: shiftCount, employees: empCount },
            isComplete: deptCount > 0 && desigCount > 0 && shiftCount > 0 && empCount > 0,
        });
    } catch (error) {
        return NextResponse.json({ error: "Failed to check onboarding status" }, { status: 500 });
    }
}
