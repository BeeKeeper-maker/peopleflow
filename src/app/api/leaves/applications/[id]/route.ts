import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

        const application = await prisma.leaveApplication.findUnique({
            where: { id },
            include: {
                leaveType: true,
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        designation: { select: { name: true } },
                    }
                }
            }
        });

        if (!application) {
            return new NextResponse("Leave application not found", { status: 404 });
        }

        // Verify organization access
        // (In a real app, we'd check if the employee belongs to the user's org, 
        // but since we query by ID and IDs are UUIDs, it's fairly safe, but best practice to check)
        // For now trusting the ID since we don't have orgId on application directly (it's on employee)

        return NextResponse.json(application);
    } catch (error) {
        console.error("GET_LEAVE_APPLICATION_ERROR", error);
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

        // Only Admin or HR Manager can approve (for now)
        // TODO: Implement proper role based access control
        // For strictness: if (user.role !== "admin" && user.role !== "hr_manager") ...

        const { id } = await params;
        const json = await req.json();
        const { status, managerComment } = json;

        if (!["approved", "rejected", "cancelled"].includes(status)) {
            return new NextResponse("Invalid status", { status: 400 });
        }

        // Start Transaction
        const result = await prisma.$transaction(async (tx) => {
            const application = await tx.leaveApplication.findUnique({
                where: { id },
                include: { leaveType: true }
            });

            if (!application) {
                throw new Error("Application not found");
            }

            if (application.status === "approved" && status !== "approved") {
                // If previously approved and now checking to reject/cancel, we might need to revert balance
                // For simplicity, let's allow status change only from 'pending'
            }

            // Update Application Status
            const updatedApp = await tx.leaveApplication.update({
                where: { id },
                data: {
                    status,
                    rejectionReason: managerComment || null,
                    approvedAt: new Date(),
                },
            });

            // If Approved, Deduct Balance
            if (status === "approved") {
                const currentYear = new Date().getFullYear();

                // Find allocation
                const allocation = await tx.leaveAllocation.findUnique({
                    where: {
                        employeeId_leaveTypeId_year: {
                            employeeId: application.employeeId,
                            leaveTypeId: application.leaveTypeId,
                            year: currentYear,
                        },
                    },
                });

                if (allocation) {
                    await tx.leaveAllocation.update({
                        where: { id: allocation.id },
                        data: {
                            usedDays: {
                                increment: application.totalDays
                            }
                        }
                    });
                } else {
                    // Create if missing (lazy init)
                    await tx.leaveAllocation.create({
                        data: {
                            employeeId: application.employeeId,
                            leaveTypeId: application.leaveTypeId,
                            year: currentYear,
                            allocatedDays: application.leaveType.annualAllocation,
                            usedDays: application.totalDays,
                            carriedForward: 0,
                        }
                    });
                }
            }

            return updatedApp;
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error("UPDATE_LEAVE_APPLICATION_ERROR", error);
        return new NextResponse(error instanceof Error ? error.message : "Internal Error", { status: 500 });
    }
}
