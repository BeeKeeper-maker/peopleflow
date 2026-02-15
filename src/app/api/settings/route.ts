import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const user = session.user
        const organizationId = user.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 })
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                name: true,
                logoUrl: true,
                industry: true,
                employeeCountRange: true,
                fiscalYearStart: true,
                timezone: true
            }
        })

        return NextResponse.json({ organization })
    } catch (error) {
        console.error("Settings fetch error:", error)
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        )
    }
}

export async function PATCH(req: NextRequest) {
    try {
        // Require HR admin role for updating organization settings
        const auth = await requireAdminOrHR()
        if (!isAuthenticated(auth)) {
            return auth
        }

        const organizationId = auth.organizationId

        const body = await req.json()

        const updatedOrg = await prisma.organization.update({
            where: { id: organizationId },
            data: {
                name: body.name,
                logoUrl: body.logoUrl,
                industry: body.industry,
                fiscalYearStart: body.fiscalYearStart,
                timezone: body.timezone
            }
        })

        return NextResponse.json({ organization: updatedOrg })
    } catch (error) {
        console.error("Settings update error:", error)
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        )
    }
}
