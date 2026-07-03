import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { SUPPORTED_CURRENCIES } from "@/lib/expense-engine";
import * as z from "zod";

/**
 * GET /api/settings/exchange-rates — List all exchange rates
 *
 * Returns all cached rates + the list of supported currencies.
 * Also returns rates that are missing (supported but no cached rate).
 */
export async function GET() {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const rates = await prisma.exchangeRate.findMany({
            where: { baseCurrency: "BDT" },
            orderBy: { quoteCurrency: "asc" },
        });

        // Build a map of available rates
        const rateMap = new Map(rates.map((r) => [r.quoteCurrency, r]));

        // Build the full list including missing rates
        const currencies = SUPPORTED_CURRENCIES.filter((c) => c.code !== "BDT").map((c) => ({
            ...c,
            rate: rateMap.get(c.code)?.rate ?? null,
            fetchedAt: rateMap.get(c.code)?.fetchedAt ?? null,
            source: rateMap.get(c.code)?.source ?? null,
            isStale:
                rateMap.get(c.code) &&
                Date.now() - rateMap.get(c.code)!.fetchedAt.getTime() > 7 * 24 * 60 * 60 * 1000,
        }));

        return NextResponse.json({
            data: currencies,
            total: currencies.length,
            ratesCount: rates.length,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_EXCHANGE_RATES_ERROR");
        return NextResponse.json({ error: "Failed to fetch exchange rates" }, { status: 500 });
    }
}

const updateRateSchema = z.object({
    quoteCurrency: z.string().min(3).max(5),
    rate: z.number().positive("Rate must be positive"),
    source: z.string().optional().default("manual"),
});

/**
 * PATCH /api/settings/exchange-rates — Update a single exchange rate (manual override)
 *
 * Body: { quoteCurrency: "USD", rate: 117.5, source: "manual" }
 *
 * This is for manual rate updates. Automatic updates happen via a cron
 * job that fetches from an external API.
 */
export async function PATCH(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = updateRateSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.issues },
                { status: 400 },
            );
        }

        const { quoteCurrency, rate, source } = validation.data;

        // Validate currency is supported
        const isSupported = SUPPORTED_CURRENCIES.some((c) => c.code === quoteCurrency);
        if (!isSupported) {
            return NextResponse.json(
                { error: `Unsupported currency: ${quoteCurrency}` },
                { status: 400 },
            );
        }

        // Upsert the rate
        const updated = await prisma.exchangeRate.upsert({
            where: {
                baseCurrency_quoteCurrency: {
                    baseCurrency: "BDT",
                    quoteCurrency,
                },
            },
            create: {
                baseCurrency: "BDT",
                quoteCurrency,
                rate,
                source,
            },
            update: {
                rate,
                source,
                fetchedAt: new Date(),
            },
        });

        apiLogger.info(
            { quoteCurrency, rate, updatedBy: ctx.userId },
            "Exchange rate updated manually",
        );

        return NextResponse.json({
            success: true,
            rate: updated,
            message: `Exchange rate for ${quoteCurrency} updated to ${rate} BDT`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_EXCHANGE_RATE_ERROR");
        return NextResponse.json({ error: "Failed to update exchange rate" }, { status: 500 });
    }
}

/**
 * POST /api/settings/exchange-rates — Refresh all rates from external API
 *
 * This is a placeholder for the auto-refresh endpoint. In production,
 * this would call an external exchange rate API (e.g., exchangerate-api.com)
 * and update all rates in bulk.
 *
 * For now, it returns a message indicating the cron job handles this.
 */
export async function POST() {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    return NextResponse.json({
        success: false,
        message: "Automatic rate refresh is handled by the exchange-rate-refresh cron job. Use PATCH to update individual rates manually.",
    });
}
