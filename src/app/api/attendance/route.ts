import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { rateLimit, RATE_LIMIT_CONFIGS, applyRateLimitHeaders } from "@/lib/rate-limit";
import { attendanceLogger } from "@/lib/logger";

function buildDateFilter(searchParams: URLSearchParams) {
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (date) {
        // Attendance dates are stored as local office-day start (e.g. Asia/Dhaka midnight),
        // not UTC midnight. Parse date-only filters as local dates so today's check-in appears
        // in today's employee/manager views.
        const start = new Date(`${date}T00:00:00`);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { gte: start, lt: end };
    }

    if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        const end = endDate ? new Date(`${endDate}T00:00:00`) : new Date();
        end.setHours(23, 59, 59, 999);
        return { gte: start, lte: end };
    }

    if (year && month) {
        const y = Number(year);
        const m = Number(month);
        if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 1);
            return { gte: start, lt: end };
        }
    }

    return undefined;
}

function toAttendanceDto(record: Awaited<ReturnType<typeof prisma.attendance.findMany>>[number]) {
    const totalMinutes = record.checkIn && record.checkOut
        ? Math.max(0, Math.round((record.checkOut.getTime() - record.checkIn.getTime()) / 60000))
        : 0;

    return {
        ...record,
        checkInTime: record.checkIn,
        checkOutTime: record.checkOut,
        totalMinutes,
    };
}

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) {
        return auth;
    }

    // Per-user rate limit (potentially large date-range reads)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, auth.userId);
    if (!rl.allowed) return rl.response!;

    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));
        const requestedEmployeeId = searchParams.get("employeeId");
        const dateFilter = buildDateFilter(searchParams);
        const isPrivileged = ["super_admin", "admin", "hr_admin", "manager"].includes(auth.role);

        const where: any = {
            employee: {
                organizationId: auth.organizationId,
            },
        };

        if (dateFilter) {
            where.date = dateFilter;
        }

        if (requestedEmployeeId) {
            if (!isPrivileged && requestedEmployeeId !== auth.employeeId) {
                return new NextResponse("Forbidden", { status: 403 });
            }

            const employeeWhere: any = {
                id: requestedEmployeeId,
                organizationId: auth.organizationId,
            };

            if (auth.role === "manager") {
                employeeWhere.reportingManagerId = auth.employeeId;
            }

            const employee = await auth.withDB((db) => db.employee.findFirst({
                where: employeeWhere,
                select: { id: true },
            }));
            if (!employee) {
                return new NextResponse("Employee not found", { status: 404 });
            }
            where.employeeId = employee.id;
        } else if (auth.role === "manager") {
            if (!auth.employeeId) return NextResponse.json([]);
            const reportees = await auth.withDB((db) => db.employee.findMany({
                where: {
                    organizationId: auth.organizationId,
                    reportingManagerId: auth.employeeId,
                    deletedAt: null,
                },
                select: { id: true },
            }));

            if (reportees.length === 0) return NextResponse.json([]);
            where.employeeId = { in: reportees.map((employee) => employee.id) };
        } else if (!isPrivileged) {
            if (!auth.employeeId) return NextResponse.json([]);
            where.employeeId = auth.employeeId;
        }

        const attendances = await auth.withDB((db) => db.attendance.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                        department: { select: { name: true } },
                        designation: { select: { name: true } },
                    },
                },
            },
            orderBy: {
                date: "desc",
            },
            take: limit,
        }));

        return applyRateLimitHeaders(
            NextResponse.json(attendances.map(toAttendanceDto)),
            rl.headers,
        );

    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        attendanceLogger.error({ err: error, errorId }, "GET_ATTENDANCE_HISTORY_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
