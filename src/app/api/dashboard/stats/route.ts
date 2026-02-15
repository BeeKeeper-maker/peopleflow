import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, isAuthenticated } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth()
        if (!isAuthenticated(auth)) {
            return auth
        }

        const organizationId = auth.organizationId

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Get employee stats
        const totalEmployees = await prisma.employee.count({
            where: {
                organizationId,
                deletedAt: null,
                employmentStatus: "active"
            }
        })

        // Get today's attendance
        const presentToday = await prisma.attendance.count({
            where: {
                employee: { organizationId },
                date: {
                    gte: today,
                    lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                },
                status: { in: ["present", "late"] }
            }
        })

        // Get pending leave requests
        const pendingLeaves = await prisma.leaveApplication.count({
            where: {
                employee: { organizationId },
                status: "pending"
            }
        })

        // Get current active leaves (people on leave today)
        const onLeaveToday = await prisma.leaveApplication.count({
            where: {
                employee: { organizationId },
                status: "approved",
                fromDate: { lte: today },
                toDate: { gte: today }
            }
        })

        // Get recent activities
        const recentLeaves = await prisma.leaveApplication.findMany({
            where: { employee: { organizationId } },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
                employee: {
                    select: { firstName: true, lastName: true }
                },
                leaveType: {
                    select: { name: true }
                }
            }
        })

        // Get pending approvals for managers
        const pendingApprovals = await prisma.leaveApplication.findMany({
            where: {
                employee: { organizationId },
                status: "pending"
            },
            take: 5,
            include: {
                employee: {
                    select: { firstName: true, lastName: true }
                },
                leaveType: {
                    select: { name: true }
                }
            }
        })

        // Calculate attendance percentage
        const attendancePercentage = totalEmployees > 0
            ? Math.round((presentToday / totalEmployees) * 100)
            : 0

        return NextResponse.json({
            stats: {
                totalEmployees,
                presentToday,
                onLeaveToday,
                pendingLeaves,
                attendancePercentage
            },
            recentActivities: recentLeaves.map(leave => ({
                type: "leave",
                title: `${leave.employee.firstName} ${leave.employee.lastName}`,
                description: `Requested ${leave.leaveType.name} leave`,
                time: leave.createdAt,
                avatar: `${leave.employee.firstName[0]}${leave.employee.lastName[0]}`
            })),
            pendingApprovals: pendingApprovals.map(leave => ({
                id: leave.id,
                name: `${leave.employee.firstName} ${leave.employee.lastName}`,
                type: "Leave Request",
                details: `${leave.totalDays} days ${leave.leaveType.name}`
            }))
        })
    } catch (error) {
        console.error("Dashboard stats error:", error)
        return NextResponse.json(
            { error: "Failed to fetch dashboard stats" },
            { status: 500 }
        )
    }
}
