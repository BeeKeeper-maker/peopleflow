import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/generated/prisma"
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth"
import { apiLogger } from "@/lib/logger";
import { toPlainSettings } from "@/lib/settings-json";

export async function GET() {
    try {
        const auth = await requireAuth()
        if (!isAuthenticated(auth)) return auth

        const organizationId = auth.organizationId

        if (!organizationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 404 })
        }

        const organization = await auth.withDB((db) =>
            db.organization.findUnique({
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
                    // BD Compliance fields (Phase 2.2)
                    binNumber: true,
                    tinNumber: true,
                    vatNumber: true,
                    tradeLicenseNumber: true,
                    tradeLicenseExpiry: true,
                    binExpiry: true,
                }
            }),
        )

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

        const existingOrg = await auth.withDB((db) =>
            db.organization.findUnique({
                where: { id: organizationId },
                select: { settings: true },
            }),
        )
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
                letterheadTitle: String(body.documents.letterheadTitle || ""),
                legalName: String(body.documents.legalName || ""),
                tradeLicenseNo: String(body.documents.tradeLicenseNo || ""),
                taxId: String(body.documents.taxId || ""),
                officePhone: String(body.documents.officePhone || ""),
                officeEmail: String(body.documents.officeEmail || ""),
                website: String(body.documents.website || ""),
                signatoryName: String(body.documents.signatoryName || ""),
                signatoryDesignation: String(body.documents.signatoryDesignation || ""),
                signatureImageUrl: String(body.documents.signatureImageUrl || ""),
                companySealUrl: String(body.documents.companySealUrl || ""),
                footerNote: String(body.documents.footerNote || ""),
            }
        }

        const updatedOrg = await auth.withDB((db) =>
            db.organization.update({
                where: { id: organizationId },
                data: {
                    name: body.name,
                    logoUrl: body.logoUrl,
                    industry: body.industry,
                    fiscalYearStart: body.fiscalYearStart,
                    timezone: body.timezone,
                    currencyCode: body.currency,
                    settings: nextSettings as Prisma.InputJsonValue,
                    // BD Compliance fields (Phase 2.2)
                    binNumber: body.binNumber ?? null,
                    tinNumber: body.tinNumber ?? null,
                    vatNumber: body.vatNumber ?? null,
                    tradeLicenseNumber: body.tradeLicenseNumber ?? null,
                    tradeLicenseExpiry: body.tradeLicenseExpiry ? new Date(body.tradeLicenseExpiry) : null,
                    binExpiry: body.binExpiry ? new Date(body.binExpiry) : null,
                }
            }),
        )

        return NextResponse.json({ organization: updatedOrg })
    } catch (error) {
        apiLogger.error({ err: error }, "Settings update error:")
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        )
    }
}
