/**
 * Platform Admin API: GET /api/platform/employees/:id
 *
 * Returns full employee data for the platform admin profile view.
 * Bypasses tenant auth (uses platform JWT instead).
 * Fetches same deep includes as the existing employees API but with platform-level access.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    verifyPlatformRequest,
    isPlatformVerified,
} from "@/lib/platform-token";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    // Platform auth check
    const auth = await verifyPlatformRequest(req);
    if (!isPlatformVerified(auth)) return auth;

    const { id } = await params;

    try {
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                department: { select: { id: true, name: true, code: true } },
                designation: { select: { id: true, name: true, grade: true } },
                branch: { select: { id: true, name: true, code: true } },
                shift: { select: { id: true, name: true, startTime: true, endTime: true } },
                reportingManager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        photoUrl: true,
                        employeeCode: true,
                    },
                },
                salaryAssignments: {
                    where: { isActive: true },
                    include: {
                        salaryStructure: { select: { name: true, code: true } },
                    },
                    orderBy: { effectiveFrom: "desc" },
                    take: 1,
                },
            },
        });

        if (!employee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        return NextResponse.json(employee);
    } catch (error) {
        console.error("[PLATFORM_EMPLOYEE_PROFILE_ERROR]", error);
        return NextResponse.json(
            { error: "Failed to load employee profile" },
            { status: 500 }
        );
    }
}
