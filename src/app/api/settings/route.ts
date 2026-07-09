import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/generated/prisma"
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth"
import { apiLogger } from "@/lib/logger";
import { toPlainSettings } from "@/lib/settings-json";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

// ── bKash credential redaction ────────────────────────────────────
// The disbursement engine reads encrypted credentials from
// `Organization.settings.bkashConfig` directly via Prisma (server-side
// only). When the settings API serializes the org for the client, we
// must NEVER expose the secret fields (appSecret, password). We also
// surface a `configured` flag and decrypt the non-secret identifiers
// (appKey, username) so the settings UI can pre-fill them.
function redactBkashConfig(raw: unknown): Record<string, unknown> | undefined {
    if (!raw || typeof raw !== "object") return undefined;
    const bkash = raw as Record<string, unknown>;
    const hasAppKey = typeof bkash.appKey === "string" && bkash.appKey.length > 0;
    const hasAppSecret = typeof bkash.appSecret === "string" && bkash.appSecret.length > 0;
    const hasUsername = typeof bkash.username === "string" && bkash.username.length > 0;
    const hasPassword = typeof bkash.password === "string" && bkash.password.length > 0;
    const configured = hasAppKey && hasAppSecret && hasUsername && hasPassword;
    if (!configured) return undefined;

    // Decrypt non-secret identifiers for client display. Best-effort — if
    // decryption fails (e.g. key rotation), return only the configured flag.
    const safeDecrypt = (value: unknown): string | undefined => {
        if (typeof value !== "string" || value.length === 0) return undefined;
        try {
            return isEncrypted(value) ? decrypt(value) : value;
        } catch (err) {
            apiLogger.warn({ err }, "Failed to decrypt bKash field for settings GET");
            return undefined;
        }
    };

    return {
        configured: true,
        sandbox: bkash.sandbox !== false,
        appKey: safeDecrypt(bkash.appKey) ?? "",
        username: safeDecrypt(bkash.username) ?? "",
    };
}

/**
 * Normalize inbound bKash config from a PATCH body.
 * Encrypts each sensitive field (appKey, appSecret, username, password)
 * individually with AES-256-GCM before persistence. Non-secret fields
 * (sandbox, baseUrl) are stored as-is.
 *
 * Returns `null` when the input is missing/invalid — caller should skip
 * the merge in that case.
 */
function buildEncryptedBkashConfig(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== "object") return null;
    const body = input as Record<string, unknown>;

    const appKey = typeof body.appKey === "string" ? body.appKey.trim() : "";
    const appSecret = typeof body.appSecret === "string" ? body.appSecret.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    const sandbox = body.sandbox !== false; // default to sandbox
    const baseUrl = typeof body.baseUrl === "string" && body.baseUrl.length > 0
        ? body.baseUrl
        : (sandbox
            ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta"
            : "https://tokenized.pay.bka.sh/v1.2.0-beta");

    // All four credential fields must be present when saving. The UI is
    // responsible for re-entering secrets on update (we never echo them
    // back). Empty values are rejected so we never persist a half-written
    // credential set that would break the disbursement engine's `getBkashConfig`.
    if (!appKey || !appSecret || !username || !password) {
        return null;
    }

    return {
        appKey: encrypt(appKey),
        appSecret: encrypt(appSecret),
        username: encrypt(username),
        password: encrypt(password),
        sandbox,
        baseUrl,
    };
}

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

        // Redact bKash secrets before exposing settings to the client.
        // The disbursement engine reads encrypted credentials directly
        // from the DB; the API response only carries a safe view.
        const safeSettings: Record<string, unknown> = { ...settings };
        const redactedBkash = redactBkashConfig(settings.bkashConfig);
        if (redactedBkash) {
            safeSettings.bkashConfig = redactedBkash;
        } else {
            delete safeSettings.bkashConfig;
        }

        return NextResponse.json({
            organization: {
                ...organization,
                currency: organization.currencyCode,
                dateFormat: typeof settings.dateFormat === "string" ? settings.dateFormat : "DD/MM/YYYY",
                workWeekStart: typeof settings.workWeekStart === "number" ? settings.workWeekStart : 0,
                documents,
                settings: safeSettings,
            },
        })
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "Settings fetch error:");
        return NextResponse.json(
            { error: "Failed to fetch settings", errorId },
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

        // bKash disbursement credentials — encrypt each sensitive field
        // before persistence. The disbursement engine decrypts them
        // server-side when calling the bKash API.
        if (body.bkashConfig !== undefined) {
            const encrypted = buildEncryptedBkashConfig(body.bkashConfig);
            if (encrypted) {
                nextSettings.bkashConfig = encrypted;
            } else {
                return NextResponse.json(
                    { error: "Invalid bKash credentials — all four fields (appKey, appSecret, username, password) are required." },
                    { status: 400 },
                );
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
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "Settings update error:");
        return NextResponse.json(
            { error: "Failed to update settings", errorId },
            { status: 500 }
        )
    }
}
