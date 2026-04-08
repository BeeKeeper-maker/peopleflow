import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiLogger } from "@/lib/logger";

// GET /api/settings/notifications - Get notification preferences
export async function GET(req: NextRequest) {
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

        const settings = (org?.settings as Record<string, any>) || {}
        const notifications = settings.notifications || {
            emailNotifications: true,
            leaveApprovals: true,
            payrollAlerts: true,
            attendanceReminders: true,
            systemUpdates: false,
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
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const user = session.user
        const organizationId = user.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 })
        }

        const body = await req.json()
        const { emailNotifications, leaveApprovals, payrollAlerts, attendanceReminders, systemUpdates } = body

        // Get current settings
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true },
        })

        const currentSettings = (org?.settings as Record<string, any>) || {}

        // Update notification preferences in settings JSON
        currentSettings.notifications = {
            emailNotifications: emailNotifications ?? true,
            leaveApprovals: leaveApprovals ?? true,
            payrollAlerts: payrollAlerts ?? true,
            attendanceReminders: attendanceReminders ?? true,
            systemUpdates: systemUpdates ?? false,
        }

        await prisma.organization.update({
            where: { id: organizationId },
            data: { settings: currentSettings },
        })

        return NextResponse.json({ success: true, notifications: currentSettings.notifications })
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_NOTIFICATION_SETTINGS_ERROR")
        return NextResponse.json(
            { error: "Failed to update notification settings" },
            { status: 500 }
        )
    }
}
