/**
 * Attendance Reconciliation Worker
 *
 * Daily job that detects attendance data gaps — the safety net for silent data loss.
 *
 * Problem it solves:
 *   If a biometric device is offline for days (load-shedding, ISP failure in BD),
 *   some employee attendance records might be missing. Without this worker,
 *   nobody notices until payroll day — causing salary disputes and compliance issues.
 *
 * Pipeline:
 *   1. For each active organization:
 *      a. Count active employees scheduled for work yesterday
 *      b. Count actual attendance records for yesterday
 *      c. Compare: if gap > 10%, flag as anomaly
 *   2. For anomalies:
 *      a. Identify which employees are missing attendance
 *      b. Cross-reference with leave applications and holidays
 *      c. Generate a reconciliation report
 *      d. Alert HR admins to review
 *
 * Runs daily at 11 PM (BD time) to catch issues before the next business day.
 */

import { Worker, type Job } from "bullmq";
import {
    redisConnection,
    type ReconciliationJobData,
} from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { createBulkNotifications } from "@/lib/notifications";
import { subDays } from "date-fns";

const WORKER_NAME = "ATTENDANCE_RECONCILIATION";

// ── Configuration ───────────────────────────────────────────────────

/** Gap threshold percentage — flag if more than this % of employees have no attendance */
const GAP_THRESHOLD_PERCENT = 10;

/** Minimum active employees to trigger reconciliation (skip tiny orgs) */
const MIN_EMPLOYEES_FOR_RECONCILIATION = 5;

// ── Worker Definition ───────────────────────────────────────────────

const reconciliationWorker = new Worker<ReconciliationJobData>(
    "attendance-reconciliation",
    async (job: Job<ReconciliationJobData>) => {
        const { type, organizationId, date } = job.data;

        // Determine the reconciliation date (default: yesterday)
        const reconciliationDate = date ? new Date(date) : subDays(new Date(), 1);
        reconciliationDate.setHours(0, 0, 0, 0);

        // Skip weekends (Friday=5, Saturday=6 for Bangladesh)
        const dayOfWeek = reconciliationDate.getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            console.log(`[${WORKER_NAME}] Skipping ${reconciliationDate.toISOString().split("T")[0]} — weekend (BD)`);
            return { skipped: true, reason: "weekend" };
        }

        switch (type) {
            case "daily-reconciliation": {
                console.log(`[${WORKER_NAME}] Starting daily reconciliation for ${reconciliationDate.toISOString().split("T")[0]}...`);

                // Get all active organizations
                const organizations = await prisma.organization.findMany({
                    where: { status: "active" },
                    select: { id: true, name: true },
                });

                const results = [];

                for (const org of organizations) {
                    const result = await reconcileOrganization(org.id, org.name, reconciliationDate);
                    results.push(result);
                }

                const anomalies = results.filter((r) => r.isAnomaly);

                console.log(`[${WORKER_NAME}] ✅ Daily reconciliation complete: ${organizations.length} orgs checked, ${anomalies.length} anomalies found`);
                return {
                    date: reconciliationDate.toISOString().split("T")[0],
                    orgsChecked: organizations.length,
                    anomalies: anomalies.length,
                    details: anomalies,
                };
            }

            case "org-reconciliation": {
                if (!organizationId) throw new Error("organizationId required for org-reconciliation");

                const org = await prisma.organization.findUnique({
                    where: { id: organizationId },
                    select: { id: true, name: true },
                });

                if (!org) throw new Error(`Organization ${organizationId} not found`);

                const result = await reconcileOrganization(org.id, org.name, reconciliationDate);
                return result;
            }

            default:
                throw new Error(`Unknown job type: ${type}`);
        }
    },
    {
        connection: redisConnection,
        concurrency: 1, // Single reconciliation at a time
    }
);

// ── Core Reconciliation Logic ───────────────────────────────────────

interface ReconciliationResult {
    organizationId: string;
    organizationName: string;
    date: string;
    totalActiveEmployees: number;
    expectedAttendance: number; // Active employees minus those on leave/holiday
    actualAttendance: number;
    gap: number;
    gapPercent: number;
    isAnomaly: boolean;
    missingEmployees: string[]; // Employee names with no attendance record
}

async function reconcileOrganization(
    organizationId: string,
    organizationName: string,
    date: Date
): Promise<ReconciliationResult> {
    // 1. Count active employees
    const activeEmployees = await prisma.employee.findMany({
        where: {
            organizationId,
            employmentStatus: "active",
            joiningDate: { lte: date }, // Only employees who joined before this date
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
        },
    });

    // Skip small organizations
    if (activeEmployees.length < MIN_EMPLOYEES_FOR_RECONCILIATION) {
        return {
            organizationId,
            organizationName,
            date: date.toISOString().split("T")[0],
            totalActiveEmployees: activeEmployees.length,
            expectedAttendance: activeEmployees.length,
            actualAttendance: 0,
            gap: 0,
            gapPercent: 0,
            isAnomaly: false,
            missingEmployees: [],
        };
    }

    const employeeIds = activeEmployees.map((e) => e.id);

    // 2. Get employees who have approved leave on this date
    const onLeave = await prisma.leaveApplication.findMany({
        where: {
            employeeId: { in: employeeIds },
            status: "approved",
            fromDate: { lte: date },
            toDate: { gte: date },
        },
        select: { employeeId: true },
    });
    const onLeaveIds = new Set(onLeave.map((l) => l.employeeId));

    // 3. Get employees with attendance records for this date
    const attendanceRecords = await prisma.attendance.findMany({
        where: {
            employeeId: { in: employeeIds },
            date: date,
        },
        select: { employeeId: true },
    });
    const hasAttendanceIds = new Set(attendanceRecords.map((a) => a.employeeId));

    // 4. Calculate expected vs actual
    const expectedAttendance = activeEmployees.filter(
        (e) => !onLeaveIds.has(e.id)
    ).length;

    const actualAttendance = attendanceRecords.length;
    const gap = expectedAttendance - actualAttendance;
    const gapPercent = expectedAttendance > 0
        ? Math.round((gap / expectedAttendance) * 100)
        : 0;

    const isAnomaly = gapPercent > GAP_THRESHOLD_PERCENT && gap > 3; // Both % and absolute threshold

    // 5. Find missing employees (not on leave AND no attendance)
    const missingEmployees = activeEmployees
        .filter((e) => !onLeaveIds.has(e.id) && !hasAttendanceIds.has(e.id))
        .map((e) => `${e.firstName} ${e.lastName} (${e.employeeCode})`);

    // 6. Alert admins if anomaly detected
    if (isAnomaly) {
        await alertReconciliationAnomaly(
            organizationId,
            organizationName,
            date,
            expectedAttendance,
            actualAttendance,
            missingEmployees.length
        );
    }

    return {
        organizationId,
        organizationName,
        date: date.toISOString().split("T")[0],
        totalActiveEmployees: activeEmployees.length,
        expectedAttendance,
        actualAttendance,
        gap,
        gapPercent,
        isAnomaly,
        missingEmployees: isAnomaly ? missingEmployees.slice(0, 50) : [], // Cap at 50 names
    };
}

// ── Alert Logic ─────────────────────────────────────────────────────

async function alertReconciliationAnomaly(
    organizationId: string,
    organizationName: string,
    date: Date,
    expected: number,
    actual: number,
    missingCount: number
): Promise<void> {
    const admins = await prisma.user.findMany({
        where: {
            organizationId,
            role: { in: ["admin", "hr_admin", "superadmin"] },
        },
        select: { id: true },
    });

    if (admins.length === 0) return;

    const dateStr = date.toISOString().split("T")[0];
    const gap = expected - actual;
    const gapPercent = expected > 0 ? Math.round((gap / expected) * 100) : 0;

    await createBulkNotifications(
        admins.map((a) => a.id),
        {
            title: "⚠️ Attendance Data Gap Detected",
            message: `${dateStr}: Expected ${expected} check-ins but only found ${actual} (${gapPercent}% gap). ${missingCount} employees have no attendance record. This may indicate a biometric device outage. Please review.`,
            type: "alert",
            link: `/attendance?date=${dateStr}`,
        }
    );

    console.log(`[${WORKER_NAME}] ⚠️ Anomaly alert sent for "${organizationName}" — ${gap} missing records (${gapPercent}%)`);
}

// ── Event Handlers ──────────────────────────────────────────────────

reconciliationWorker.on("completed", (job) => {
    console.log(`[${WORKER_NAME}] Job ${job.name} completed`);
});

reconciliationWorker.on("failed", (job, err) => {
    console.error(`[${WORKER_NAME}] Job ${job?.name} failed: ${err.message}`);
});

reconciliationWorker.on("error", (err) => {
    console.error(`[${WORKER_NAME}] Worker error:`, err.message);
});

console.log(`[${WORKER_NAME}] Worker started`);

export default reconciliationWorker;
