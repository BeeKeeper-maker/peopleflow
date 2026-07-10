import { NextResponse } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { subDays, format } from "date-fns";
import { apiLogger } from "@/lib/logger";
import { startOfBusinessDay, addBusinessDays } from "@/lib/biometric/attendance-ingest";

export async function GET() {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const orgId = auth.organizationId;
        const todayStart = startOfBusinessDay(new Date());
        const todayEnd = addBusinessDays(todayStart, 1);
        const thirtyDaysAgo = subDays(todayStart, 30);

        // 1. Daily Stats (Today)
        const dailyStats = await auth.withDB((db) => db.attendance.groupBy({
            by: ['status'],
            where: {
                employee: { organizationId: orgId },
                date: {
                    gte: todayStart,
                    lt: todayEnd
                }
            },
            _count: {
                status: true
            }
        }));

        // 2. Monthly Trends (Last 30 Days)
        const monthlyData = await auth.withDB((db) => db.attendance.findMany({
            where: {
                employee: { organizationId: orgId },
                date: {
                    gte: thirtyDaysAgo,
                    lt: todayEnd
                }
            },
            select: {
                date: true,
                status: true
            },
            orderBy: { date: 'asc' }
        }));

        // Process monthly data for chart chart: { date: '2023-10-01', present: 5, late: 2, absent: 1 }
        const trendMap = new Map<string, Record<string, number | string>>();
        monthlyData.forEach(record => {
            const dateStr = format(new Date(record.date), 'yyyy-MM-dd');
            if (!trendMap.has(dateStr)) {
                trendMap.set(dateStr, { date: dateStr, present: 0, late: 0, absent: 0, half_day: 0 });
            }
            const entry = trendMap.get(dateStr) as Record<string, number | string>;
            // Map status directly or categorize
            const status = record.status.toLowerCase(); // present, late, absent, half-day
            if (typeof entry[status] === "number") {
                entry[status] = Number(entry[status]) + 1;
            } else if (status === 'check-in') {
                // Counts as present for now if incomplete
                entry['present'] = Number(entry['present']) + 1;
            }
        });
        const monthlyTrends = Array.from(trendMap.values());

        // 3. Late/Early Offenders (Top 5 this month)
        // Grouping by employee is tricky with Prisma findMany vs groupBy limited relations.
        // We'll fetch all 'late' or 'early' records for the last 30 days and aggregate in JS.
        const lateEarlyRecords = await auth.withDB((db) => db.attendance.findMany({
            where: {
                employee: { organizationId: orgId },
                date: {
                    gte: thirtyDaysAgo
                },
                OR: [
                    { status: 'late' },
                    { earlyLeaveMinutes: { gt: 0 } }
                ]
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                        photoUrl: true,
                        department: { select: { name: true } } // needed for UI
                    }
                }
            }
        }));

        const offenderMap = new Map<string, {
            employee: (typeof lateEarlyRecords)[number]["employee"];
            lateCount: number;
            earlyLeaveCount: number;
            totalLateMinutes: number;
        }>();
        lateEarlyRecords.forEach(record => {
            const empId = record.employeeId;
            if (!offenderMap.has(empId)) {
                offenderMap.set(empId, {
                    employee: record.employee,
                    lateCount: 0,
                    earlyLeaveCount: 0,
                    totalLateMinutes: 0 // We assume we might calculate this if we had data, currently aggregation is count based
                });
            }
            const entry = offenderMap.get(empId);
            if (!entry) return;
            if (record.status === 'late') entry.lateCount++;
            if (record.earlyLeaveMinutes && record.earlyLeaveMinutes > 0) entry.earlyLeaveCount++;
        });

        const offenders = Array.from(offenderMap.values())
            .sort((a, b) => (b.lateCount + b.earlyLeaveCount) - (a.lateCount + a.earlyLeaveCount))
            .slice(0, 10); // Top 10

        return NextResponse.json({
            daily: dailyStats.reduce<Record<string, number>>((acc, curr) => {
                acc[curr.status.toLowerCase()] = curr._count.status;
                return acc;
            }, {}), // { present: 5, late: 2 }
            monthly: monthlyTrends,
            offenders: offenders
        });

    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "REPORTS_API_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
