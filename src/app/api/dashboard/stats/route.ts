import { NextRequest, NextResponse } from "next/server"
import { requireAuth, isAuthenticated } from "@/lib/api-auth"
import { apiLogger } from "@/lib/logger";

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth()
        if (!isAuthenticated(auth)) {
            return auth
        }

        const organizationId = auth.organizationId

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const stats = await auth.withDB(async (db) => {
            // Get employee stats
            const totalEmployees = await db.employee.count({
                where: {
                    organizationId,
                    deletedAt: null,
                    employmentStatus: "active"
                }
            })

            // Get today's attendance
            const presentToday = await db.attendance.count({
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
            const pendingLeaves = await db.leaveApplication.count({
                where: {
                    employee: { organizationId },
                    status: "pending"
                }
            })

            // Get current active leaves (people on leave today)
            const onLeaveToday = await db.leaveApplication.count({
                where: {
                    employee: { organizationId },
                    status: "approved",
                    fromDate: { lte: today },
                    toDate: { gte: today }
                }
            })

            // Get recent activities
            const recentLeaves = await db.leaveApplication.findMany({
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
            const pendingApprovals = await db.leaveApplication.findMany({
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

            return { totalEmployees, presentToday, onLeaveToday, pendingLeaves, attendancePercentage, recentLeaves, pendingApprovals }
        })

        return NextResponse.json({
            stats: {
                totalEmployees: stats.totalEmployees,
                presentToday: stats.presentToday,
                onLeaveToday: stats.onLeaveToday,
                pendingLeaves: stats.pendingLeaves,
                attendancePercentage: stats.attendancePercentage
            },
            recentActivities: stats.recentLeaves.map((leave: any) => ({
                type: "leave",
                title: `${leave.employee.firstName} ${leave.employee.lastName}`,
                description: `Requested ${leave.leaveType.name} leave`,
                time: leave.createdAt,
                avatar: `${leave.employee.firstName[0]}${leave.employee.lastName[0]}`
            })),
            pendingApprovals: stats.pendingApprovals.map((leave: any) => ({
                id: leave.id,
                name: `${leave.employee.firstName} ${leave.employee.lastName}`,
                type: "Leave Request",
                details: `${leave.totalDays} days ${leave.leaveType.name}`
            }))
        })
    } catch (error) {
        apiLogger.error({ err: error }, "Dashboard stats error:")
        return NextResponse.json(
            { error: "Failed to fetch dashboard stats" },
            { status: 500 }
        )
    }
}
