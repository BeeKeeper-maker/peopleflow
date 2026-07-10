import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import {
    generateFestivalBonus,
    listFestivalBonusConfigs,
    getFestivalBonusSummary,
} from "@/lib/festival-bonus-engine";

import { payrollLogger } from "@/lib/logger";

// GET /api/payroll/festival-bonus — List all bonus configs for the org
export async function GET(req: NextRequest) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const year = req.nextUrl.searchParams.get("year");
        const configs = await listFestivalBonusConfigs(
            auth.organizationId,
            year ? parseInt(year) : undefined
        );
        return NextResponse.json({ data: configs });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        payrollLogger.error({ err: error, errorId }, "FESTIVAL_BONUS_LIST_ERROR");
        return NextResponse.json(
            { error: "Failed to fetch festival bonus configs", errorId },
            { status: 500 }
        );
    }
}

// POST /api/payroll/festival-bonus — Create a new bonus config OR generate bonus
export async function POST(req: NextRequest) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const body = await req.json();

        // If action=generate, trigger the bonus generation engine
        if (body.action === "generate") {
            const result = await generateFestivalBonus({
                bonusConfigId: body.bonusConfigId,
            });
            return NextResponse.json({ data: result });
        }

        // Otherwise, create a new config
        const config = await auth.withDB((db) => db.festivalBonusConfig.create({
            data: {
                organizationId: auth.organizationId,
                name: body.name,
                festivalType: body.festivalType,
                year: body.year || new Date().getFullYear(),
                percentageOfBasis: body.percentageOfBasis || 100,
                calculationBasis: body.calculationBasis || "basic",
                minimumServiceDays: body.minimumServiceDays || 0,
                proRataForNewJoinee: body.proRataForNewJoinee ?? true,
                includeProbation: body.includeProbation ?? false,
                includeContractual: body.includeContractual ?? false,
                status: "draft",
            },
        }));

        return NextResponse.json({ data: config }, { status: 201 });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        payrollLogger.error({ err: error, errorId }, "FESTIVAL_BONUS_CREATE_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
