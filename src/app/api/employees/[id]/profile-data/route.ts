import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { toNumber } from "@/lib/payroll-engine";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/employees/:id/profile-data
 * Returns aggregated data for the Employee Profile "Command Center":
 * attendance summary, leave balances, salary slips, and document metadata.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    const { id } = await params;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Calculate date ranges
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
        const employee = await auth.withDB((db) =>
            db.employee.findFirst({
                where: { id, organizationId: auth.organizationId, deletedAt: null },
                select: { id: true },
            }),
        );

        if (!employee) {
            return new NextResponse("Employee not found", { status: 404 });
        }

        const [
            attendance90d,
            leaveAllocations,
            leaveApplications,
            salarySlips,
        ] = await auth.withDB((db) =>
            Promise.all([
                // Last 90 days of attendance
                db.attendance.findMany({
                    where: {
                        employeeId: id,
                        date: { gte: ninetyDaysAgo },
                    },
                    orderBy: { date: "desc" },
                }),
                // Current year leave allocations with type
                db.leaveAllocation.findMany({
                    where: {
                        employeeId: id,
                        year: currentYear,
                    },
                    include: { leaveType: true },
                }),
                // Leave applications (last 12 months)
                db.leaveApplication.findMany({
                    where: {
                        employeeId: id,
                        fromDate: {
                            gte: new Date(currentYear - 1, currentMonth - 1, 1),
                        },
                    },
                    include: { leaveType: true },
                    orderBy: { fromDate: "desc" },
                    take: 20,
                }),
                // Salary slips (last 12)
                db.salarySlip.findMany({
                    where: { employeeId: id },
                    orderBy: [{ year: "desc" }, { month: "desc" }],
                    take: 12,
                }),
            ]),
        );

        // ── Attendance Summary (30-day) ────────────────────────────────
        const attendance30d = attendance90d.filter(
            (a) => new Date(a.date) >= thirtyDaysAgo
        );
        const presentDays = attendance30d.filter((a) => a.status === "present").length;
        const absentDays = attendance30d.filter((a) => a.status === "absent").length;
        const lateDays = attendance30d.filter((a) => a.lateMinutes > 0).length;
        const onTimeDays = attendance30d.filter((a) => a.status === "present" && a.lateMinutes === 0).length;
        const totalTracked = attendance30d.length;
        const attendanceRate = totalTracked > 0 ? Math.round((presentDays / totalTracked) * 100) : 0;
        const punctualityRate = presentDays > 0 ? Math.round((onTimeDays / presentDays) * 100) : 0;
        const avgLateMinutes = lateDays > 0
            ? Math.round(attendance30d.reduce((sum, a) => sum + a.lateMinutes, 0) / lateDays)
            : 0;

        // Weekly attendance for chart (last 12 weeks grouped)
        const weeklyData = [];
        for (let i = 11; i >= 0; i--) {
            const weekEnd = new Date(now);
            weekEnd.setDate(weekEnd.getDate() - i * 7);
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 7);
            const weekRecords = attendance90d.filter((a) => {
                const d = new Date(a.date);
                return d >= weekStart && d < weekEnd;
            });
            weeklyData.push({
                week: `W${12 - i}`,
                present: weekRecords.filter((a) => a.status === "present").length,
                absent: weekRecords.filter((a) => a.status === "absent").length,
                late: weekRecords.filter((a) => a.lateMinutes > 0).length,
                leave: weekRecords.filter((a) => a.status === "on_leave").length,
            });
        }

        // Daily punch timeline (last 14 days)
        const punchTimeline = attendance90d.slice(0, 14).map((a) => ({
            date: a.date,
            checkIn: a.checkIn,
            checkOut: a.checkOut,
            status: a.status,
            lateMinutes: a.lateMinutes,
            earlyLeaveMinutes: a.earlyLeaveMinutes,
            overtimeMinutes: a.overtimeMinutes,
            source: a.source,
        }));

        // ── Leave Summary ──────────────────────────────────────────────
        const leaveBalances = leaveAllocations.map((alloc) => ({
            type: alloc.leaveType.name,
            color: alloc.leaveType.color || "#3b82f6",
            allocated: alloc.allocatedDays,
            used: alloc.usedDays,
            carried: alloc.carriedForward,
            remaining: alloc.allocatedDays + alloc.carriedForward - alloc.usedDays,
        }));

        const leaveHistory = leaveApplications.map((app) => ({
            id: app.id,
            type: app.leaveType.name,
            from: app.fromDate,
            to: app.toDate,
            days: app.totalDays,
            status: app.status,
            reason: app.reason,
            halfDay: app.halfDay,
        }));

        // ── Payroll Summary ────────────────────────────────────────────
        const latestSlip = salarySlips[0] || null;

        // Phase 1 (Float → Decimal): coerce Decimal slip monetary fields to JS numbers
        // so JSON serialization produces numbers (the Employee Profile "Command Center"
        // renders these as currency strings via `formatCurrency(amount: number)`).
        const payrollHistory = salarySlips.map((s) => ({
            month: s.month,
            year: s.year,
            gross: toNumber(s.grossSalary),
            net: toNumber(s.netSalary),
            deductions: toNumber(s.totalDeductions),
            basic: toNumber(s.basicSalary),
            hra: toNumber(s.houseRent),
            medical: toNumber(s.medicalAllowance),
            conveyance: toNumber(s.conveyance),
            pf: toNumber(s.pfEmployee),
            tax: toNumber(s.incomeTax),
            status: s.status,
        }));

        return NextResponse.json({
            attendance: {
                rate: attendanceRate,
                punctualityRate,
                present: presentDays,
                absent: absentDays,
                late: lateDays,
                onTime: onTimeDays,
                totalTracked,
                avgLateMinutes,
                weeklyData,
                punchTimeline,
            },
            leave: {
                balances: leaveBalances,
                history: leaveHistory,
                totalUsed: leaveBalances.reduce((s, b) => s + b.used, 0),
                totalRemaining: leaveBalances.reduce((s, b) => s + b.remaining, 0),
            },
            payroll: {
                current: latestSlip ? {
                    gross: toNumber(latestSlip.grossSalary),
                    net: toNumber(latestSlip.netSalary),
                    deductions: toNumber(latestSlip.totalDeductions),
                    basic: toNumber(latestSlip.basicSalary),
                    hra: toNumber(latestSlip.houseRent),
                    medical: toNumber(latestSlip.medicalAllowance),
                    conveyance: toNumber(latestSlip.conveyance),
                    pf: toNumber(latestSlip.pfEmployee),
                    tax: toNumber(latestSlip.incomeTax),
                    month: latestSlip.month,
                    year: latestSlip.year,
                } : null,
                history: payrollHistory,
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "PROFILE_DATA_ERROR");
        return NextResponse.json({ error: "Failed to load profile data" }, { status: 500 });
    }
}
