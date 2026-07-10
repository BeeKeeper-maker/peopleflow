import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma";
import { attendanceLogger } from "@/lib/logger";

type RegularizationStatus = "PENDING" | "APPROVED" | "REJECTED";
type RegularizationMeta = {
    status?: RegularizationStatus;
    reason?: string;
    requestedStatus?: string;
    requestedCheckIn?: string | null;
    requestedCheckOut?: string | null;
    submittedAt?: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectedBy?: string;
    rejectedAt?: string;
};

function parseRegularizationNotes(notes: string | null): RegularizationMeta {
    try {
        const jsonStr = notes?.replace("[REGULARIZATION] ", "") || "{}";
        return JSON.parse(jsonStr) as RegularizationMeta;
    } catch {
        return { status: "PENDING" };
    }
}

function formatRequestedTime(value?: string | null): string | null {
    if (!value) return null;
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function businessDateFromInput(value: string): Date {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, y, m, d] = match;
        return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0));
    }
    const parsed = new Date(value);
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0));
}

/**
 * GET — List regularization requests.
 *
 * For admin/HR: returns all pending + recent requests across the org.
 * For normal employees: returns only their own requests.
 *
 * Regularization requests are stored as Attendance records whose
 * `notes` field starts with "[REGULARIZATION]" and contain a JSON
 * payload with status = PENDING / APPROVED / REJECTED.
 */
export async function GET(req: Request) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const isAdmin = ["super_admin", "admin", "hr_admin"].includes(ctx.role);
        const { searchParams } = new URL(req.url);
        const statusFilter = (searchParams.get("status") || "all").toUpperCase();

        // Build employee scope
        let employeeFilter: Record<string, unknown> = {};
        if (!isAdmin) {
            const emp = await auth.withDB((db) => db.employee.findFirst({
                where: { userId: ctx.userId, organizationId: ctx.organizationId },
                select: { id: true },
            }));
            if (!emp) return NextResponse.json({ requests: [] });
            employeeFilter = { employeeId: emp.id };
        }

        // Fetch attendance records with regularization notes
        const records = await auth.withDB((db) => db.attendance.findMany({
            where: {
                employee: { organizationId: ctx.organizationId },
                notes: { startsWith: "[REGULARIZATION]" },
                ...employeeFilter,
            } satisfies Prisma.AttendanceWhereInput,
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeCode: true,
                        department: { select: { name: true } },
                    },
                },
            },
        }));

        const requests = records.map((r) => {
            const regData = parseRegularizationNotes(r.notes);

            return {
                id: r.id,
                date: r.date.toISOString(),
                reason: regData.reason || "",
                requestedCheckIn: formatRequestedTime(regData.requestedCheckIn),
                requestedCheckOut: formatRequestedTime(regData.requestedCheckOut),
                status: (regData.status || "PENDING").toLowerCase(),
                createdAt: r.createdAt.toISOString(),
                employee: {
                    firstName: r.employee.firstName,
                    lastName: r.employee.lastName,
                    employeeCode: r.employee.employeeCode,
                    department: r.employee.department,
                },
            };
        });

        const filteredRequests = statusFilter === "ALL"
            ? requests
            : requests.filter((request) => request.status.toUpperCase() === statusFilter);

        return NextResponse.json({ requests: filteredRequests });
    } catch (error) {
        attendanceLogger.error({ err: error }, "Regularization list error:");
        return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
    }
}

/**
 * POST — Submit a new regularization request (any authenticated employee).
 */
export async function POST(req: Request) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const body = await req.json();
        const { date, requestedCheckIn, requestedCheckOut, reason } = body;

        if (!date) {
            return NextResponse.json({ error: "Date is required" }, { status: 400 });
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }

        // Prevent future dates
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (parsedDate > today) {
            return NextResponse.json({ error: "Cannot regularize future dates" }, { status: 400 });
        }

        if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
            return NextResponse.json({ error: "Reason is required (minimum 3 characters)" }, { status: 400 });
        }

        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: { userId: ctx.userId, organizationId: ctx.organizationId },
            select: { id: true },
        }));

        if (!employee) {
            return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
        }

        const dateStart = businessDateFromInput(date);

        // Build regularization metadata
        const regularizationData = {
            status: "PENDING",
            reason: reason.trim(),
            requestedStatus: "present",
            requestedCheckIn: typeof requestedCheckIn === "string" && /^\d{2}:\d{2}$/.test(requestedCheckIn) ? requestedCheckIn : null,
            requestedCheckOut: typeof requestedCheckOut === "string" && /^\d{2}:\d{2}$/.test(requestedCheckOut) ? requestedCheckOut : null,
            submittedAt: new Date().toISOString(),
        };
        const notesStr = `[REGULARIZATION] ${JSON.stringify(regularizationData)}`;

        // Upsert: update existing attendance or create new
        const existing = await auth.withDB((db) => db.attendance.findFirst({
            where: { employeeId: employee.id, date: dateStart },
        }));

        if (existing) {
            // Don't overwrite if already regularized/approved
            if (existing.notes?.includes('"status":"APPROVED"')) {
                return NextResponse.json({ error: "This date has already been regularized" }, { status: 400 });
            }
            await auth.withDB((db) => db.attendance.update({
                where: { id: existing.id },
                data: { notes: notesStr, source: "regularization" },
            }));
        } else {
            await auth.withDB((db) => db.attendance.create({
                data: {
                    date: dateStart,
                    employeeId: employee.id,
                    organizationId: ctx.organizationId,
                    status: "absent",
                    source: "regularization",
                    notes: notesStr,
                },
            }));
        }

        return NextResponse.json({
            success: true,
            message: "Regularization request submitted. Pending manager approval.",
        });
    } catch (error) {
        attendanceLogger.error({ err: error }, "Regularization submit error:");
        return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
    }
}
