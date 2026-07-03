import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { executeReport } from "@/lib/report-engine";
import * as z from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;

        const report = await prisma.savedReport.findFirst({
            where: {
                id,
                organizationId: ctx.organizationId,
                OR: [{ createdBy: ctx.userId }, { isShared: true }],
            },
            include: {
                schedules: true,
            },
        });

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        return NextResponse.json(report);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_SAVED_REPORT_ERROR");
        return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json();

        const report = await prisma.savedReport.findFirst({
            where: {
                id,
                organizationId: ctx.organizationId,
                OR: [{ createdBy: ctx.userId }, { isShared: true }],
            },
        });

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const updated = await prisma.savedReport.update({
            where: { id },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.fields !== undefined && { fields: body.fields }),
                ...(body.filters !== undefined && { filters: body.filters as object }),
                ...(body.groupBy !== undefined && { groupBy: body.groupBy }),
                ...(body.chartType !== undefined && { chartType: body.chartType }),
                ...(body.isShared !== undefined && { isShared: body.isShared }),
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_SAVED_REPORT_ERROR");
        return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;

        const report = await prisma.savedReport.findFirst({
            where: { id, organizationId: ctx.organizationId, createdBy: ctx.userId },
        });

        if (!report) {
            return NextResponse.json(
                { error: "Report not found or you don't have permission to delete it" },
                { status: 404 },
            );
        }

        await prisma.savedReport.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_SAVED_REPORT_ERROR");
        return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
    }
}

// ── Run report on demand ──

const runReportSchema = z.object({
    overrideFilters: z.record(z.string(), z.unknown()).optional(),
    limit: z.number().min(1).max(10000).optional(),
    format: z.enum(["json", "csv"]).default("json"),
});

/**
 * POST /api/reports/custom/[id]/run — Execute the saved report
 *
 * Returns structured data (columns + rows + summary) for table/chart rendering.
 * Supports filter overrides for ad-hoc execution.
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const validation = runReportSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.issues },
                { status: 400 },
            );
        }

        const report = await prisma.savedReport.findFirst({
            where: {
                id,
                organizationId: ctx.organizationId,
                OR: [{ createdBy: ctx.userId }, { isShared: true }],
            },
        });

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        const filters = {
            ...(report.filters as Record<string, unknown>),
            ...(validation.data.overrideFilters || {}),
        };

        const result = await executeReport({
            organizationId: ctx.organizationId,
            dataSource: report.dataSource,
            fields: report.fields,
            filters,
            groupBy: report.groupBy,
            limit: validation.data.limit,
        });

        // CSV format
        if (validation.data.format === "csv") {
            const csv = convertToCSV(result);
            return new NextResponse(csv, {
                status: 200,
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, "_")}.csv"`,
                },
            });
        }

        return NextResponse.json({
            report: {
                id: report.id,
                name: report.name,
                dataSource: report.dataSource,
                chartType: report.chartType,
            },
            result,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "RUN_REPORT_ERROR");
        return NextResponse.json({ error: "Failed to run report" }, { status: 500 });
    }
}

function convertToCSV(result: {
    columns: Array<{ key: string; label: string }>;
    rows: Record<string, unknown>[];
}): string {
    const headers = result.columns.map((c) => c.label).join(",");
    const rows = result.rows.map((row) =>
        result.columns
            .map((col) => {
                const val = row[col.key];
                if (val === null || val === undefined) return "";
                if (val instanceof Date) return val.toISOString().split("T")[0];
                const str = String(val);
                // Escape quotes and wrap in quotes if contains comma
                if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            })
            .join(","),
    );
    return [headers, ...rows].join("\n");
}
