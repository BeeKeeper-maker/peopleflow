import { prisma } from "@/lib/prisma"

type NotificationType =
    | "leave_approval"
    | "leave_request"
    | "payroll"
    | "attendance"
    | "employee"
    | "announcement"
    | "alert"

interface CreateNotificationParams {
    userId: string
    title: string
    message: string
    type: NotificationType
    link?: string
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
    const { userId, title, message, type, link } = params

    return prisma.notification.create({
        data: {
            userId,
            title,
            message,
            type,
            link,
        },
    })
}

/**
 * Bulk create notifications for multiple users
 */
export async function createBulkNotifications(
    userIds: string[],
    params: Omit<CreateNotificationParams, "userId">
) {
    const { title, message, type, link } = params

    return prisma.notification.createMany({
        data: userIds.map((userId) => ({
            userId,
            title,
            message,
            type,
            link,
        })),
    })
}

/**
 * Notify admins/HR about a leave request
 */
export async function notifyLeaveRequest(
    organizationId: string,
    employeeName: string,
    leaveType: string,
    applicationId: string
) {
    // Find all HR admins in the organization
    const admins = await prisma.user.findMany({
        where: {
            organizationId,
            role: { in: ["admin", "hr_admin", "superadmin"] },
        },
        select: { id: true },
    })

    if (admins.length === 0) return

    await createBulkNotifications(
        admins.map((a) => a.id),
        {
            title: "New Leave Request",
            message: `${employeeName} has submitted a ${leaveType} leave request`,
            type: "leave_request",
            link: `/leaves/requests?id=${applicationId}`,
        }
    )
}

/**
 * Notify employee about leave approval/rejection
 */
export async function notifyLeaveDecision(
    userId: string,
    status: "approved" | "rejected",
    leaveType: string
) {
    await createNotification({
        userId,
        title: status === "approved" ? "Leave Approved ✓" : "Leave Rejected",
        message: `Your ${leaveType} leave request has been ${status}`,
        type: "leave_approval",
        link: "/leaves",
    })
}

/**
 * Notify about payroll processing
 */
export async function notifyPayrollProcessed(
    userIds: string[],
    month: number,
    year: number
) {
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]

    await createBulkNotifications(userIds, {
        title: "Salary Slip Generated",
        message: `Your salary slip for ${monthNames[month - 1]} ${year} is ready`,
        type: "payroll",
        link: `/payroll`,
    })
}

/**
 * Create an announcement notification for all users
 */
export async function createAnnouncement(
    organizationId: string,
    title: string,
    message: string,
    link?: string
) {
    const users = await prisma.user.findMany({
        where: { organizationId },
        select: { id: true },
    })

    await createBulkNotifications(
        users.map((u) => u.id),
        {
            title,
            message,
            type: "announcement",
            link,
        }
    )
}
