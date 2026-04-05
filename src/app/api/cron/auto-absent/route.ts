/**
 * CRON: Auto-Mark Absent
 * 
 * Endpoint: GET /api/cron/auto-absent
 * Schedule: Daily at 23:59 (or configurable)
 * 
 * Iterates all organizations and calls autoMarkAbsent() for each.
 * Skips weekends automatically (handled by the engine).
 * Emits attendance.auto_absent.completed events per organization.
 */

import { verifyCronAuth, cronResponse } from "@/lib/cron-auth";
import { autoMarkAbsent } from "@/lib/attendance-engine";
import { emit } from "@/lib/event-bus";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for large orgs

export async function GET(req: Request) {
    // ── Auth ──
    const authError = verifyCronAuth(req);
    if (authError) return authError;

    const startTime = Date.now();

    try {
        // Get target date from query params or default to today
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get("date");
        const targetDate = dateParam ? new Date(dateParam + "T00:00:00.000Z") : new Date();
        targetDate.setHours(0, 0, 0, 0);

        // Get all active organizations (status field, not isActive)
        const organizations = await prisma.organization.findMany({
            where: { status: "active" },
            select: { id: true, name: true },
        });

        let totalMarked = 0;
        let totalSkipped = 0;
        const errors: string[] = [];
        const orgResults: Array<{
            orgName: string;
            marked: number;
            skipped: number;
            status: string;
        }> = [];

        for (const org of organizations) {
            try {
                const result = await autoMarkAbsent(org.id, targetDate);

                if (result.skipped === -1) {
                    // Weekend skip
                    orgResults.push({
                        orgName: org.name,
                        marked: 0,
                        skipped: 0,
                        status: "skipped_weekend",
                    });
                    continue;
                }

                totalMarked += result.marked;
                totalSkipped += result.skipped;
                errors.push(...result.errors);

                orgResults.push({
                    orgName: org.name,
                    marked: result.marked,
                    skipped: result.skipped,
                    status: result.errors.length > 0 ? "partial" : "success",
                });

                // Emit event for HR notification
                await emit("attendance.auto_absent.completed", {
                    organizationId: org.id,
                    organizationName: org.name,
                    date: targetDate.toISOString().split("T")[0],
                    markedAbsent: result.marked,
                    skipped: result.skipped,
                });
            } catch (orgError) {
                const msg = orgError instanceof Error ? orgError.message : String(orgError);
                errors.push(`[${org.name}] ${msg}`);
                orgResults.push({
                    orgName: org.name,
                    marked: 0,
                    skipped: 0,
                    status: "error",
                });
            }
        }

        const durationMs = Date.now() - startTime;

        return cronResponse(
            {
                job: "auto-absent",
                date: targetDate.toISOString().split("T")[0],
                organizations: organizations.length,
                totalMarked,
                totalSkipped,
                errorCount: errors.length,
                durationMs,
                details: orgResults,
                errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
            },
            errors.length > 0 ? "partial" : "success"
        );
    } catch (error) {
        console.error("[CRON] auto-absent FATAL:", error);
        return cronResponse(
            {
                job: "auto-absent",
                error: error instanceof Error ? error.message : "Unknown error",
                durationMs: Date.now() - startTime,
            },
            "error"
        );
    }
}
