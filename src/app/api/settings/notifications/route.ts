import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth"
import { apiLogger } from "@/lib/logger";
import { toPlainSettings } from "@/lib/settings-json";

// GET /api/settings/notifications - Get notification preferences
export async function GET() {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const user = session.user
        const organizationId = user.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 })
        }

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true },
        })

        const settings = toPlainSettings(org?.settings)
        const savedNotifications = toPlainSettings(settings.notifications)
        const notifications = {
            emailNotifications: typeof savedNotifications.emailNotifications === "boolean" ? savedNotifications.emailNotifications : true,
            leaveApprovals: typeof savedNotifications.leaveApprovals === "boolean" ? savedNotifications.leaveApprovals : true,
            payrollAlerts: typeof savedNotifications.payrollAlerts === "boolean" ? savedNotifications.payrollAlerts : true,
            attendanceReminders: typeof savedNotifications.attendanceReminders === "boolean" ? savedNotifications.attendanceReminders : true,
            systemUpdates: typeof savedNotifications.systemUpdates === "boolean" ? savedNotifications.systemUpdates : false,
        }

        return NextResponse.json({ notifications })
    } catch (error) {
        apiLogger.error({ err: error }, "GET_NOTIFICATION_SETTINGS_ERROR")
        return NextResponse.json(
            { error: "Failed to fetch notification settings" },
            { status: 500 }
        )
    }
}

// PATCH /api/settings/notifications - Update notification preferences
export async function PATCH(req: NextRequest) {
    try {
        const authContext = await requireAdminOrHR()
        if (!isAuthenticated(authContext)) return authContext

        const organizationId = authContext.organizationId

        const body = await req.json()
        const { emailNotifications, leaveApprovals, payrollAlerts, attendanceReminders, systemUpdates } = body

        // Get current settings
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true },
        })

        const currentSettings = toPlainSettings(org?.settings)
        const previousNotifications = toPlainSettings(currentSettings.notifications)

        const notifications = {
            emailNotifications: typeof emailNotifications === "boolean" ? emailNotifications : previousNotifications.emailNotifications !== false,
            leaveApprovals: typeof leaveApprovals === "boolean" ? leaveApprovals : previousNotifications.leaveApprovals !== false,
            payrollAlerts: typeof payrollAlerts === "boolean" ? payrollAlerts : previousNotifications.payrollAlerts !== false,
            attendanceReminders: typeof attendanceReminders === "boolean" ? attendanceReminders : previousNotifications.attendanceReminders !== false,
            systemUpdates: typeof systemUpdates === "boolean" ? systemUpdates : previousNotifications.systemUpdates === true,
        }

        const updatedSettings = {
            ...currentSettings,
            notifications,
        }

        await prisma.organization.update({
            where: { id: organizationId },
            data: { settings: updatedSettings },
        })

        return NextResponse.json({ success: true, notifications })
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_NOTIFICATION_SETTINGS_ERROR")
        return NextResponse.json(
            { error: "Failed to update notification settings" },
            { status: 500 }
        )
    }
}
