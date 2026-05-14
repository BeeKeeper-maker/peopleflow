import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma"
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth"
import { apiLogger } from "@/lib/logger";
import { toPlainSettings } from "@/lib/settings-json";

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

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                name: true,
                logoUrl: true,
                industry: true,
                employeeCountRange: true,
                fiscalYearStart: true,
                currencyCode: true,
                timezone: true,
                settings: true,
            }
        })

        if (!organization) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 })
        }

        const settings = toPlainSettings(organization.settings)
        const documents =
            typeof settings.documents === "object" && settings.documents !== null && !Array.isArray(settings.documents)
                ? settings.documents
                : {}

        return NextResponse.json({
            organization: {
                ...organization,
                currency: organization.currencyCode,
                dateFormat: typeof settings.dateFormat === "string" ? settings.dateFormat : "DD/MM/YYYY",
                workWeekStart: typeof settings.workWeekStart === "number" ? settings.workWeekStart : 0,
                documents,
            },
        })
    } catch (error) {
        apiLogger.error({ err: error }, "Settings fetch error:")
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

        const existingOrg = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { settings: true },
        })
        const currentSettings = toPlainSettings(existingOrg?.settings)
        const nextSettings = { ...currentSettings }

        if (body.dateFormat !== undefined) nextSettings.dateFormat = String(body.dateFormat || "DD/MM/YYYY")
        if (body.workWeekStart !== undefined) nextSettings.workWeekStart = Number(body.workWeekStart) || 0
        if (body.documents !== undefined && typeof body.documents === "object" && body.documents !== null) {
            const existingDocuments =
                typeof currentSettings.documents === "object" && currentSettings.documents !== null && !Array.isArray(currentSettings.documents)
                    ? currentSettings.documents as Record<string, unknown>
                    : {}
            nextSettings.documents = {
                ...existingDocuments,
                orgAddress: String(body.documents.orgAddress || ""),
                signatoryName: String(body.documents.signatoryName || ""),
                signatoryDesignation: String(body.documents.signatoryDesignation || ""),
                signatureImageUrl: String(body.documents.signatureImageUrl || ""),
            }
        }

        const updatedOrg = await prisma.organization.update({
            where: { id: organizationId },
            data: {
                name: body.name,
                logoUrl: body.logoUrl,
                industry: body.industry,
                fiscalYearStart: body.fiscalYearStart,
                timezone: body.timezone,
                currencyCode: body.currency,
                settings: nextSettings as Prisma.InputJsonValue,
            }
        })

        return NextResponse.json({ organization: updatedOrg })
    } catch (error) {
        apiLogger.error({ err: error }, "Settings update error:")
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        )
    }
}
