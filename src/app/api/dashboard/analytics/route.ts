import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// Module-level constant — no re-allocation per request
const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * GET - Dashboard analytics data
 * 
 * ✅ Performance optimized:
 *  - Headcount trend: 2 queries (batch) instead of 24 (loop)
 *  - Payroll trend: 1 aggregate query instead of 6
 *  - Birthday date calc: no mutation of source objects
 */
export async function GET(req: Request) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const orgId = ctx.organizationId;
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        // ============================================
        // 1. Headcount Statistics (optimized)
        // ============================================
        const [totalEmployees, newHiresThisMonth, separationsThisMonth] = await Promise.all([
            prisma.employee.count({
                where: { organizationId: orgId, employmentStatus: "active" },
            }),
            prisma.employee.count({
                where: {
                    organizationId: orgId,
                    joiningDate: {
                        gte: new Date(today.getFullYear(), today.getMonth(), 1),
                        lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
                    },
                },
            }),
            prisma.employee.count({
                where: {
                    organizationId: orgId,
                    employmentStatus: { in: ["terminated", "resigned"] },
                    updatedAt: {
                        gte: new Date(today.getFullYear(), today.getMonth(), 1),
                    },
                },
            }),
        ]);

        // ✅ OPTIMIZED: Batch headcount trend — 2 queries instead of 24
        const trendMonths = 12;
        const trendStartDate = new Date(today.getFullYear(), today.getMonth() - trendMonths + 1, 1);

        const [allHires, allSeparations] = await Promise.all([
            prisma.employee.findMany({
                where: {
                    organizationId: orgId,
                    joiningDate: { gte: trendStartDate },
                },
                select: { joiningDate: true },
            }),
            prisma.employee.findMany({
                where: {
                    organizationId: orgId,
                    employmentStatus: { in: ["terminated", "resigned"] },
                    updatedAt: { gte: trendStartDate },
                },
                select: { updatedAt: true },
            }),
        ]);

        const headcountTrend = [];
        for (let i = trendMonths - 1; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const m = d.getMonth();
            const y = d.getFullYear();

            const hires = allHires.filter(e => {
                const jd = new Date(e.joiningDate);
                return jd.getMonth() === m && jd.getFullYear() === y;
            }).length;

            const seps = allSeparations.filter(e => {
                const ud = new Date(e.updatedAt);
                return ud.getMonth() === m && ud.getFullYear() === y;
            }).length;

            headcountTrend.push({
                month: `${MONTH_NAMES[m]} ${y}`,
                hires,
                separations: seps,
            });
        }

        // ============================================
        // 2. Department Distribution
        // ============================================
        const departments = await prisma.department.findMany({
            where: { organizationId: orgId },
            include: {
                _count: {
                    select: { employees: true },
                },
            },
        });

        const departmentDistribution = departments.map(d => ({
            name: d.name,
            count: d._count.employees,
        }));

        // ============================================
        // 3. Today's Attendance
        // ============================================
        const todayAttendance = await prisma.attendance.groupBy({
            by: ["status"],
            where: {
                date: { gte: todayStart, lt: todayEnd },
                employee: { organizationId: orgId },
            },
            _count: { status: true },
        });

        const attendanceSummary: Record<string, number> = {
            present: 0,
            absent: 0,
            late: 0,
            on_leave: 0,
            half_day: 0,
        };
        todayAttendance.forEach(a => {
            attendanceSummary[a.status] = a._count.status;
        });
        attendanceSummary.notCheckedIn = Math.max(
            0,
            totalEmployees - Object.values(attendanceSummary).reduce((s, v) => s + v, 0)
        );

        // ============================================
        // 4. Leave Overview
        // ============================================
        const [pendingLeaves, onLeaveToday] = await Promise.all([
            prisma.leaveApplication.count({
                where: {
                    status: "pending",
                    employee: { organizationId: orgId },
                },
            }),
            prisma.leaveApplication.count({
                where: {
                    status: "approved",
                    fromDate: { lte: today },
                    toDate: { gte: today },
                    employee: { organizationId: orgId },
                },
            }),
        ]);

        // ============================================
        // 5. Payroll Cost Trend (✅ OPTIMIZED: 1 query instead of 6)
        // ============================================
        const payrollTrendMonths = 6;
        const payrollStartDate = new Date(today.getFullYear(), today.getMonth() - payrollTrendMonths + 1, 1);

        const allPayrolls = await prisma.salarySlip.findMany({
            where: {
                employee: { organizationId: orgId },
                status: { in: ["approved", "paid"] },
                OR: (() => {
                    const conditions = [];
                    for (let i = payrollTrendMonths - 1; i >= 0; i--) {
                        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                        conditions.push({ month: d.getMonth() + 1, year: d.getFullYear() });
                    }
                    return conditions;
                })(),
            },
            select: { month: true, year: true, grossSalary: true, netSalary: true },
        });

        const payrollCostTrend = [];
        for (let i = payrollTrendMonths - 1; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const m = d.getMonth() + 1;
            const y = d.getFullYear();

            const monthSlips = allPayrolls.filter(s => s.month === m && s.year === y);
            const totalGross = monthSlips.reduce((sum, s) => sum + s.grossSalary, 0);
            const totalNet = monthSlips.reduce((sum, s) => sum + s.netSalary, 0);

            payrollCostTrend.push({
                month: `${MONTH_NAMES[d.getMonth()]} ${y}`,
                gross: Math.round(totalGross),
                net: Math.round(totalNet),
                headcount: monthSlips.length,
            });
        }

        // ============================================
        // 6. Upcoming Birthdays & Work Anniversaries
        // ============================================
        const employees = await prisma.employee.findMany({
            where: { organizationId: orgId, employmentStatus: "active" },
            select: {
                id: true,
                dateOfBirth: true,
                joiningDate: true,
                user: { select: { name: true } },
                department: { select: { name: true } },
            },
        });

        const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        // ✅ FIXED: No date mutation — use fresh Date objects
        const upcomingBirthdays = employees
            .filter(e => e.dateOfBirth)
            .map(e => {
                const dob = new Date(e.dateOfBirth!);
                const thisYearBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
                if (thisYearBday < todayStart) {
                    thisYearBday.setFullYear(today.getFullYear() + 1);
                }
                return { employee: e, date: thisYearBday };
            })
            .filter(e => e.date >= todayStart && e.date <= next30Days)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 10)
            .map(e => ({
                name: e.employee.user?.name,
                department: e.employee.department?.name,
                date: e.date.toISOString().split("T")[0],
            }));

        const upcomingAnniversaries = employees
            .map(e => {
                const jd = new Date(e.joiningDate);
                const thisYearAnniv = new Date(today.getFullYear(), jd.getMonth(), jd.getDate());
                if (thisYearAnniv < todayStart) {
                    thisYearAnniv.setFullYear(today.getFullYear() + 1);
                }
                const years = thisYearAnniv.getFullYear() - jd.getFullYear();
                return { employee: e, date: thisYearAnniv, years };
            })
            .filter(e => e.date >= todayStart && e.date <= next30Days && e.years > 0)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 10)
            .map(e => ({
                name: e.employee.user?.name,
                department: e.employee.department?.name,
                date: e.date.toISOString().split("T")[0],
                years: e.years,
            }));

        // ============================================
        // 7. Pending Actions
        // ============================================
        const [pendingLoans, pendingExpenses] = await Promise.all([
            prisma.loan.count({
                where: {
                    status: "pending",
                    employee: { organizationId: orgId },
                },
            }),
            prisma.expenseClaim.count({
                where: {
                    status: "submitted",
                    organizationId: orgId,
                },
            }),
        ]);

        return NextResponse.json({
            headcount: {
                total: totalEmployees,
                newHires: newHiresThisMonth,
                separations: separationsThisMonth,
                trend: headcountTrend,
            },
            departments: departmentDistribution,
            attendance: attendanceSummary,
            leaves: {
                pending: pendingLeaves,
                onLeaveToday,
            },
            payrollCost: payrollCostTrend,
            upcoming: {
                birthdays: upcomingBirthdays,
                anniversaries: upcomingAnniversaries,
            },
            pendingActions: {
                leaves: pendingLeaves,
                loans: pendingLoans,
                expenses: pendingExpenses,
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "Dashboard analytics error:");
        return NextResponse.json(
            { error: "Failed to fetch analytics" },
            { status: 500 }
        );
    }
}
