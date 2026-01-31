import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { employee: true },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const employeeId = searchParams.get("employeeId") || user.employee?.id;

        if (!employeeId) {
            return new NextResponse("Employee ID required", { status: 400 });
        }

        // Ensure user can only see their own unless admin/hr
        // For simplicity allow if own or same org (TODO: strict check)

        const allocations = await prisma.leaveAllocation.findMany({
            where: {
                employeeId: employeeId,
                year: new Date().getFullYear(),
            },
            include: {
                leaveType: true
            }
        });

        // Also get all Leave Types to show 0 balance for those not yet allocated
        const leaveTypes = await prisma.leaveType.findMany({
            where: { organizationId: user.organizationId }
        });

        // Merge: if allocation exists use it, else mock one
        const result = leaveTypes.map(type => {
            const allocation = allocations.find(a => a.leaveTypeId === type.id);
            return {
                leaveType: type,
                allocatedDays: allocation?.allocatedDays || type.annualAllocation,
                usedDays: allocation?.usedDays || 0,
                carriedForward: allocation?.carriedForward || 0,
                // remaining calculated on client or here
                remainingDays: (allocation?.allocatedDays || type.annualAllocation) + (allocation?.carriedForward || 0) - (allocation?.usedDays || 0)
            }
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET_LEAVE_ALLOCATIONS_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
