/**
 * CRON: Scheduled Reports Worker
 *
 * Endpoint: GET /api/cron/scheduled-reports
 * Schedule: every 15 minutes (e.g. Coolify/EasyCron)
 *
 * Picks up ScheduledReport rows whose `nextRunAt <= now()` and:
 *   1. Executes the underlying SavedReport within the owning tenant's RLS
 *      context (withTenant).
 *   2. Emails the result to each recipient (recipients are user IDs).
 *   3. Advances `nextRunAt` based on `frequency` so the schedule fires again.
 *
 * Before this endpoint existed, rows were saved with `nextRunAt` but no
 * worker ever read them — reports silently never executed. This worker
 * closes that loop.
 *
 * RLS: the cross-tenant "find due schedules" query uses `withPlatform()`
 * (RLS bypass — platform admin only). Per-tenant work (executing the
 * SavedReport, resolving recipient emails) is wrapped in `withTenant(orgId)`.
 *
 * The report execution itself uses `executeReport` from @/lib/report-engine,
 * which already builds a structured `{ columns, rows, summary, total }`
 * result. We render the rows as an HTML table for the email body — PDF/CSV
 * attachment generation is a follow-up (the schema already supports a
 * `format` field; this MVP just sends an HTML email so the loop is closed).
 */

import { verifyCronAuth, cronResponse } from "@/lib/cron-auth";
import { withPlatform, withTenant } from "@/lib/prisma";
import { cronLogger } from "@/lib/logger";
import { executeReport } from "@/lib/report-engine";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Many schedules + email sends may take time

/**
 * Compute the next run time for a schedule.
 *
 * Mirrors the logic in src/app/api/reports/custom/[id]/schedule/route.ts
 * so the worker advances `nextRunAt` consistently with how schedules are
 * originally created (9 AM BD time = 3 AM UTC).
 */
function calculateNextRun(frequency: string, from: Date): Date {
    const next = new Date(from);

    if (frequency === "daily") {
        next.setUTCHours(3, 0, 0, 0);
        if (next <= from) {
            next.setUTCDate(next.getUTCDate() + 1);
        }
    } else if (frequency === "weekly") {
        const dayOfWeek = next.getUTCDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
        next.setUTCDate(next.getUTCDate() + daysUntilMonday);
        next.setUTCHours(3, 0, 0, 0);
    } else if (frequency === "monthly") {
        next.setUTCMonth(next.getUTCMonth() + 1, 1);
        next.setUTCHours(3, 0, 0, 0);
    } else {
        // Unknown frequency — default to daily to avoid getting stuck.
        next.setUTCHours(3, 0, 0, 0);
        if (next <= from) {
            next.setUTCDate(next.getUTCDate() + 1);
        }
    }

    return next;
}

/**
 * Render the report result as a simple HTML table for the email body.
 * Caps at 100 rows so we don't send a 50 MB email for a 50k-row report.
 */
function renderReportHtml(
    reportName: string,
    result: { columns: Array<{ key: string; label: string; type: string }>; rows: Record<string, unknown>[]; total: number },
): string {
    const visibleRows = result.rows.slice(0, 100);
    const headerCells = result.columns
        .map((c) => `<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">${escapeHtml(c.label)}</th>`)
        .join("");
    const bodyRows = visibleRows
        .map((row) => {
            const cells = result.columns
                .map((c) => {
                    const raw = row[c.key];
                    const text = raw === null || raw === undefined
                        ? ""
                        : raw instanceof Date
                          ? raw.toLocaleString()
                          : String(raw);
                    return `<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">${escapeHtml(text)}</td>`;
                })
                .join("");
            return `<tr>${cells}</tr>`;
        })
        .join("");

    const truncatedNote = result.rows.length > visibleRows.length
        ? `<p style="margin-top:12px;font-size:12px;color:#6b7280;">Showing first 100 of ${result.rows.length} rows.</p>`
        : "";

    return `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:900px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">${escapeHtml(reportName)}</h2>
            <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">
                Scheduled report — ${result.total} row(s), generated ${new Date().toLocaleString()}.
            </p>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
            ${truncatedNote}
        </div>
    `;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export async function GET(req: Request) {
    const authError = verifyCronAuth(req);
    if (authError) return authError;

    const startTime = Date.now();

    try {
        // ── Step 1: Find all due schedules across all tenants ──
        // withPlatform bypasses RLS so we can see schedules from every org.
        // Cap at 50 per run so a single cron invocation can't OOM the worker
        // if hundreds of schedules are due simultaneously.
        const dueReports = await withPlatform((db) =>
            db.scheduledReport.findMany({
                where: {
                    isActive: true,
                    nextRunAt: { lte: new Date() },
                },
                include: {
                    savedReport: true,
                },
                take: 50,
                orderBy: { nextRunAt: "asc" },
            }),
        );

        cronLogger.info(
            { count: dueReports.length },
            "Processing scheduled reports",
        );

        let successCount = 0;
        let errorCount = 0;
        const errors: Array<{ scheduleId: string; error: string }> = [];

        for (const schedule of dueReports) {
            try {
                const { savedReport, organizationId, recipients } = schedule;

                // ── Step 2: Execute the report + resolve recipient emails ──
                // Both happen inside withTenant so RLS sees the owning org.
                const { result, recipientEmails } = await withTenant(organizationId, async (db) => {
                    const reportResult = await executeReport({
                        organizationId,
                        dataSource: savedReport.dataSource,
                        fields: savedReport.fields,
                        filters: (savedReport.filters as Record<string, unknown>) ?? {},
                        groupBy: savedReport.groupBy,
                        limit: 1000,
                    });

                    const users = recipients.length > 0
                        ? await db.user.findMany({
                              where: { id: { in: recipients }, isActive: true },
                              select: { email: true },
                          })
                        : [];

                    const emails = users
                        .map((u) => u.email)
                        .filter((e): e is string => Boolean(e));

                    return { result: reportResult, recipientEmails: emails };
                });

                // ── Step 3: Email the rendered report to recipients ──
                if (recipientEmails.length > 0) {
                    const html = renderReportHtml(savedReport.name, result);
                    const sendResult = await sendEmail({
                        to: recipientEmails,
                        subject: `[PeopleFlow] Scheduled Report: ${savedReport.name}`,
                        html,
                        text: `Scheduled report "${savedReport.name}" — ${result.total} row(s). View in HTML email.`,
                    });
                    if (!sendResult.success) {
                        cronLogger.warn(
                            { scheduleId: schedule.id, error: sendResult.error },
                            "Scheduled report email send failed",
                        );
                    }
                } else {
                    cronLogger.warn(
                        { scheduleId: schedule.id, recipientCount: recipients.length },
                        "Scheduled report had no resolvable recipient emails",
                    );
                }

                // ── Step 4: Advance nextRunAt ──
                const nextRunAt = calculateNextRun(schedule.frequency, new Date());
                await withPlatform((db) =>
                    db.scheduledReport.update({
                        where: { id: schedule.id },
                        data: { lastRunAt: new Date(), nextRunAt },
                    }),
                );

                successCount++;
                cronLogger.info(
                    {
                        scheduleId: schedule.id,
                        reportId: savedReport.id,
                        rows: result.total,
                        recipients: recipientEmails.length,
                        nextRunAt: nextRunAt.toISOString(),
                    },
                    "Scheduled report executed",
                );
            } catch (err) {
                errorCount++;
                const msg = err instanceof Error ? err.message : String(err);
                errors.push({ scheduleId: schedule.id, error: msg });
                cronLogger.error(
                    { err, scheduleId: schedule.id },
                    "Scheduled report execution failed",
                );

                // Even on failure, advance nextRunAt so we don't get stuck
                // retrying the same broken schedule every cron tick. A 5-min-
                // ahead snooze gives the underlying issue (bad report config,
                // missing data source, etc.) time to be fixed without flooding
                // the logs.
                try {
                    const snooze = new Date(Date.now() + 5 * 60 * 1000);
                    await withPlatform((db) =>
                        db.scheduledReport.update({
                            where: { id: schedule.id },
                            data: { lastRunAt: new Date(), nextRunAt: snooze },
                        }),
                    );
                } catch (updateErr) {
                    cronLogger.error(
                        { err: updateErr, scheduleId: schedule.id },
                        "Failed to snooze failing schedule",
                    );
                }
            }
        }

        return cronResponse(
            {
                job: "scheduled-reports",
                processed: dueReports.length,
                successCount,
                errorCount,
                durationMs: Date.now() - startTime,
                errors: errors.length > 0 ? errors : undefined,
            },
            errorCount > 0 ? "partial" : "success",
        );
    } catch (error) {
        cronLogger.error({ err: error }, "[CRON] scheduled-reports FATAL:");
        return cronResponse(
            {
                job: "scheduled-reports",
                error: error instanceof Error ? error.message : "Unknown error",
                durationMs: Date.now() - startTime,
            },
            "error",
        );
    }
}
