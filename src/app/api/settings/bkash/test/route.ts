import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { decrypt, isEncrypted } from "@/lib/crypto";
import { toPlainSettings } from "@/lib/settings-json";

/**
 * POST /api/settings/bkash/test
 *
 * Verifies the saved bKash credentials by requesting a token from the
 * bKash tokenized checkout API. Does NOT mutate any state — pure
 * connectivity check.
 *
 * Returns:
 *   200 — { success: true, message } when bKash returns statusCode "0000"
 *   400 — credentials not configured
 *   502 — bKash API error (with statusMessage when available)
 *   500 — internal error
 */
export async function POST() {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const org = await auth.withDB((db) =>
            db.organization.findUnique({
                where: { id: auth.organizationId },
                select: { settings: true },
            }),
        );

        const settings = toPlainSettings(org?.settings);
        const raw = settings.bkashConfig as Record<string, unknown> | undefined;

        if (!raw) {
            return NextResponse.json(
                { success: false, error: "bKash credentials are not configured. Save credentials first." },
                { status: 400 },
            );
        }

        const decryptField = (value: unknown): string => {
            if (typeof value !== "string" || value.length === 0) return "";
            try {
                return isEncrypted(value) ? decrypt(value) : value;
            } catch (err) {
                apiLogger.error({ err }, "Failed to decrypt bKash credential field for test");
                return "";
            }
        };

        const username = decryptField(raw.username);
        const password = decryptField(raw.password);
        const appKey = decryptField(raw.appKey);
        const appSecret = decryptField(raw.appSecret);

        if (!username || !password || !appKey || !appSecret) {
            return NextResponse.json(
                { success: false, error: "bKash credentials are incomplete. Re-enter all four fields and save." },
                { status: 400 },
            );
        }

        const baseUrl =
            typeof raw.baseUrl === "string" && raw.baseUrl.length > 0
                ? raw.baseUrl
                : "https://tokenized.pay.bka.sh/v1.2.0-beta";

        // Call bKash token API. Mirrors the disbursement engine's flow
        // but is intentionally self-contained so a test failure can never
        // poison the engine's token cache.
        const response = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                username,
                password,
            },
            body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
        });

        const data = await response.json();

        if (data.statusCode === "0000" && data.idToken) {
            return NextResponse.json({
                success: true,
                message: "bKash connection verified — token granted successfully.",
            });
        }

        return NextResponse.json(
            {
                success: false,
                error: data.statusMessage || "bKash rejected the credentials.",
                providerStatus: data.statusCode,
            },
            { status: 502 },
        );
    } catch (error) {
        apiLogger.error({ err: error }, "BKASH_TEST_CONNECTION_ERROR");
        const message = error instanceof Error ? error.message : "Network error contacting bKash API";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 },
        );
    }
}
