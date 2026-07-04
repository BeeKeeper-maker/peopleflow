import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

const scheduleSchema = z.object({
    frequency: z.enum(["daily", "weekly", "monthly"]),
    recipients: z.array(z.string()).min(1, "At least one recipient is required"),
    format: z.enum(["pdf", "csv", "xlsx"]).default("pdf"),
    isActive: z.boolean().default(true),
});

/**
 * POST /api/reports/custom/[id]/schedule — Schedule a report for email delivery
 *
 * Calculates nextRunAt based on frequency:
 *   daily: next 9 AM BD time (3 AM UTC)
 *   weekly: next Monday 9 AM BD time
 *   monthly: 1st of next month 9 AM BD time
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json();
        const validation = scheduleSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.issues },
                { status: 400 },
            );
        }

        const { frequency, recipients, format, isActive } = validation.data;

        // Verify report exists + belongs to org
        const report = await auth.withDB((db) => db.savedReport.findFirst({
            where: {
                id,
                organizationId: ctx.organizationId,
                OR: [{ createdBy: ctx.userId }, { isShared: true }],
            },
        }));

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // Verify recipients belong to org
        const validRecipients = await auth.withDB((db) => db.user.findMany({
            where: {
                id: { in: recipients },
                organizationId: ctx.organizationId,
                isActive: true,
            },
            select: { id: true },
        }));

        if (validRecipients.length !== recipients.length) {
            return NextResponse.json(
                { error: "Some recipients are invalid or not in your organization" },
                { status: 400 },
            );
        }

        // Calculate nextRunAt (9 AM BD = 3 AM UTC)
        const now = new Date();
        const nextRunAt = calculateNextRun(frequency, now);

        const schedule = await auth.withDB((db) => db.scheduledReport.create({
            data: {
                savedReportId: id,
                frequency,
                nextRunAt,
                recipients,
                format,
                isActive,
                organizationId: ctx.organizationId,
            },
        }));

        apiLogger.info(
            { scheduleId: schedule.id, reportId: id, frequency, nextRunAt: nextRunAt.toISOString() },
            "Report scheduled",
        );

        return NextResponse.json(schedule, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "SCHEDULE_REPORT_ERROR");
        return NextResponse.json({ error: "Failed to schedule report" }, { status: 500 });
    }
}

/**
 * GET /api/reports/custom/[id]/schedule — List schedules for a report
 */
export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;

        const schedules = await auth.withDB((db) => db.scheduledReport.findMany({
            where: {
                savedReportId: id,
                organizationId: ctx.organizationId,
            },
            orderBy: { nextRunAt: "asc" },
        }));

        return NextResponse.json({ data: schedules, total: schedules.length });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_SCHEDULES_ERROR");
        return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
    }
}

function calculateNextRun(frequency: string, from: Date): Date {
    // 9 AM BD time = 3 AM UTC (BD is UTC+6)
    const next = new Date(from);

    if (frequency === "daily") {
        // Next 9 AM BD (3 AM UTC). If before 3 AM UTC today, use today; else tomorrow.
        next.setUTCHours(3, 0, 0, 0);
        if (next <= from) {
            next.setUTCDate(next.getUTCDate() + 1);
        }
    } else if (frequency === "weekly") {
        // Next Monday 9 AM BD
        const dayOfWeek = next.getUTCDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // 0=Sunday
        next.setUTCDate(next.getUTCDate() + daysUntilMonday);
        next.setUTCHours(3, 0, 0, 0);
    } else if (frequency === "monthly") {
        // 1st of next month, 9 AM BD
        next.setUTCMonth(next.getUTCMonth() + 1, 1);
        next.setUTCHours(3, 0, 0, 0);
    }

    return next;
}
