import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { getAvailableDataSources, getDataSourceDefinition } from "@/lib/report-engine";
import * as z from "zod";

/**
 * GET /api/reports/custom — List saved reports + available data sources
 *
 * Query params:
 *   - dataSource: filter by data source
 *   - includeMeta: if true, also return available data sources + field definitions
 */
export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { searchParams } = new URL(req.url);
        const dataSource = searchParams.get("dataSource");
        const includeMeta = searchParams.get("includeMeta") === "true";

        const where: Record<string, unknown> = {
            organizationId: ctx.organizationId,
            OR: [
                { createdBy: ctx.userId },
                { isShared: true },
            ],
        };
        if (dataSource) where.dataSource = dataSource;

        const reports = await prisma.savedReport.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            include: {
                _count: { select: { schedules: true } },
            },
        });

        const response: Record<string, unknown> = {
            data: reports,
            total: reports.length,
        };

        if (includeMeta) {
            response.dataSources = getAvailableDataSources();
            if (dataSource) {
                response.dataSourceDefinition = getDataSourceDefinition(dataSource);
            }
        }

        return NextResponse.json(response);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_SAVED_REPORTS_ERROR");
        return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }
}

const createReportSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional(),
    dataSource: z.string().min(1),
    fields: z.array(z.string()).min(1, "Select at least one field"),
    filters: z.record(z.string(), z.unknown()).default({}),
    groupBy: z.string().nullable().optional(),
    chartType: z.enum(["table", "bar", "line", "pie"]).nullable().optional(),
    isShared: z.boolean().default(false),
});

export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = createReportSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validation.error.issues.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        const { name, description, dataSource, fields, filters, groupBy, chartType, isShared } =
            validation.data;

        // Validate data source exists
        const def = getDataSourceDefinition(dataSource);
        if (!def) {
            return NextResponse.json(
                { error: `Invalid data source: ${dataSource}` },
                { status: 400 },
            );
        }

        // Validate all fields exist in the data source
        const validFieldKeys = new Set(def.fields.map((f) => f.key));
        const invalidFields = fields.filter((f) => !validFieldKeys.has(f));
        if (invalidFields.length > 0) {
            return NextResponse.json(
                { error: `Invalid fields for ${dataSource}: ${invalidFields.join(", ")}` },
                { status: 400 },
            );
        }

        const report = await prisma.savedReport.create({
            data: {
                name,
                description,
                dataSource,
                fields,
                filters: filters as object,
                groupBy: groupBy || null,
                chartType: chartType || null,
                isShared,
                createdBy: ctx.userId,
                organizationId: ctx.organizationId,
            },
        });

        return NextResponse.json(report, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_SAVED_REPORT_ERROR");
        return NextResponse.json({ error: "Failed to create report" }, { status: 500 });
    }
}
