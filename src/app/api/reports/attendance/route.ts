import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { apiLogger } from "@/lib/logger";

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return new NextResponse("Organization not found", { status: 400 });
        }

        const orgId = user.organizationId;
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const thirtyDaysAgo = subDays(todayStart, 30);

        // 1. Daily Stats (Today)
        const dailyStats = await prisma.attendance.groupBy({
            by: ['status'],
            where: {
                employee: { organizationId: orgId },
                date: {
                    gte: todayStart,
                    lte: todayEnd
                }
            },
            _count: {
                status: true
            }
        });

        // 2. Monthly Trends (Last 30 Days)
        const monthlyData = await prisma.attendance.findMany({
            where: {
                employee: { organizationId: orgId },
                date: {
                    gte: thirtyDaysAgo,
                    lte: todayEnd
                }
            },
            select: {
                date: true,
                status: true
            },
            orderBy: { date: 'asc' }
        });

        // Process monthly data for chart chart: { date: '2023-10-01', present: 5, late: 2, absent: 1 }
        const trendMap = new Map();
        monthlyData.forEach(record => {
            const dateStr = format(new Date(record.date), 'yyyy-MM-dd');
            if (!trendMap.has(dateStr)) {
                trendMap.set(dateStr, { date: dateStr, present: 0, late: 0, absent: 0, half_day: 0 });
            }
            const entry = trendMap.get(dateStr);
            // Map status directly or categorize
            const status = record.status.toLowerCase(); // present, late, absent, half-day
            if (entry[status] !== undefined) {
                entry[status]++;
            } else if (status === 'check-in') {
                // Counts as present for now if incomplete
                entry['present']++;
            }
        });
        const monthlyTrends = Array.from(trendMap.values());

        // 3. Late/Early Offenders (Top 5 this month)
        // Grouping by employee is tricky with Prisma findMany vs groupBy limited relations.
        // We'll fetch all 'late' or 'early' records for the last 30 days and aggregate in JS.
        const lateEarlyRecords = await prisma.attendance.findMany({
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
        });

        const offenderMap = new Map();
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
            if (record.status === 'late') entry.lateCount++;
            if (record.earlyLeaveMinutes && record.earlyLeaveMinutes > 0) entry.earlyLeaveCount++;
        });

        const offenders = Array.from(offenderMap.values())
            .sort((a, b) => (b.lateCount + b.earlyLeaveCount) - (a.lateCount + a.earlyLeaveCount))
            .slice(0, 10); // Top 10

        return NextResponse.json({
            daily: dailyStats.reduce((acc: any, curr) => {
                acc[curr.status.toLowerCase()] = curr._count.status;
                return acc;
            }, {}), // { present: 5, late: 2 }
            monthly: monthlyTrends,
            offenders: offenders
        });

    } catch (error) {
        apiLogger.error({ err: error }, "REPORTS_API_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
