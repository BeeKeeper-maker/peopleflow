import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma";
import { attendanceLogger } from "@/lib/logger";

function csvEscape(value: unknown) {
    if (value === null || value === undefined) return "";
    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildDateFilter(searchParams: URLSearchParams) {
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (!startDate && !endDate) return undefined;
    const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date("1970-01-01T00:00:00");
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();
    return { gte: start, lte: end };
}

export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    const isPrivileged = ["super_admin", "admin", "hr_admin", "manager"].includes(auth.role);
    if (!isPrivileged) return new NextResponse("Forbidden", { status: 403 });

    try {
        const { searchParams } = new URL(req.url);
        const source = searchParams.get("source") || "all";
        const dateFilter = buildDateFilter(searchParams);

        const where: Prisma.AttendanceWhereInput = {
            employee: {
                organizationId: auth.organizationId,
            },
        };

        if (auth.role === "manager") {
            if (!auth.employeeId) return new NextResponse("No reportees", { status: 404 });
            where.employee = {
                organizationId: auth.organizationId,
                reportingManagerId: auth.employeeId,
            };
        }

        if (dateFilter) where.date = dateFilter;
        if (source !== "all") where.source = source;

        const rows = await auth.withDB((db) => db.attendance.findMany({
            where,
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                        department: { select: { name: true } },
                        designation: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ date: "desc" }, { checkIn: "desc" }],
            take: 5000,
        }));

        const header = [
            "Date", "Employee Code", "Employee Name", "Department", "Designation", "Check In", "Check Out", "Status", "Source", "Late Minutes", "Early Leave Minutes", "Overtime Minutes", "Notes",
        ];
        const body = rows.map((row) => [
            row.date,
            row.employee.employeeCode,
            `${row.employee.firstName} ${row.employee.lastName}`,
            row.employee.department?.name || "",
            row.employee.designation?.name || "",
            row.checkIn,
            row.checkOut,
            row.status,
            row.source,
            row.lateMinutes,
            row.earlyLeaveMinutes,
            row.overtimeMinutes,
            row.notes,
        ].map(csvEscape).join(","));

        const csv = [header.join(","), ...body].join("\n");
        const today = new Date().toISOString().slice(0, 10);

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="peopleflow-attendance-${today}.csv"`,
            },
        });
    } catch (error) {
        attendanceLogger.error({ err: error }, "EXPORT_ATTENDANCE_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
