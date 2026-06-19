/**
 * Platform Admin API: GET /api/platform/employees/:id
 *
 * Returns full employee data for the platform admin profile view.
 * Bypasses tenant auth (uses platform JWT instead).
 * Uses withPlatform() for explicit RLS bypass — this is a cross-tenant operation.
 */
import { NextResponse, NextRequest } from "next/server";
import { withPlatform } from "@/lib/prisma";
import {
    verifyPlatformRequest,
    isPlatformVerified,
} from "@/lib/platform-token";
import { platformLogger } from "@/lib/logger";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Platform auth check
    const auth = await verifyPlatformRequest(req);
    if (!isPlatformVerified(auth)) return auth;

    const { id } = await params;

    try {
        const employee = await withPlatform((db) =>
            db.employee.findFirst({
                where: { id, deletedAt: null },
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
            })
        );

        if (!employee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        return NextResponse.json(employee);
    } catch (error) {
        platformLogger.error({ err: error, employeeId: id }, "Failed to load employee profile");
        return NextResponse.json(
            { error: "Failed to load employee profile" },
            { status: 500 }
        );
    }
}

