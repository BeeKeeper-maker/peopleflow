import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { attendanceLogger } from "@/lib/logger";

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

        // Build employee scope
        let employeeFilter: Record<string, unknown> = {};
        if (!isAdmin) {
            const emp = await prisma.employee.findFirst({
                where: { userId: ctx.userId, organizationId: ctx.organizationId },
                select: { id: true },
            });
            if (!emp) return NextResponse.json({ requests: [] });
            employeeFilter = { employeeId: emp.id };
        }

        // Fetch attendance records with regularization notes
        const records = await prisma.attendance.findMany({
            where: {
                employee: { organizationId: ctx.organizationId },
                notes: { startsWith: "[REGULARIZATION]" },
                ...employeeFilter,
            } as any,
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
        });

        const requests = records.map((r) => {
            // Parse structured notes
            let regData: Record<string, any> = {};
            try {
                const jsonStr = r.notes?.replace("[REGULARIZATION] ", "") || "{}";
                regData = JSON.parse(jsonStr);
            } catch {
                regData = { status: "PENDING" };
            }

            return {
                id: r.id,
                date: r.date.toISOString(),
                reason: regData.reason || "",
                requestedCheckIn: regData.requestedCheckIn
                    ? new Date(regData.requestedCheckIn).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                    : null,
                requestedCheckOut: regData.requestedCheckOut
                    ? new Date(regData.requestedCheckOut).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                    : null,
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

        return NextResponse.json({ requests });
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

        const employee = await prisma.employee.findFirst({
            where: { userId: ctx.userId, organizationId: ctx.organizationId },
            select: { id: true },
        });

        if (!employee) {
            return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
        }

        const dateStart = new Date(parsedDate);
        dateStart.setHours(0, 0, 0, 0);

        // Build regularization metadata
        const regularizationData = {
            status: "PENDING",
            reason: reason.trim(),
            requestedStatus: "present",
            requestedCheckIn: requestedCheckIn || null,
            requestedCheckOut: requestedCheckOut || null,
            submittedAt: new Date().toISOString(),
        };
        const notesStr = `[REGULARIZATION] ${JSON.stringify(regularizationData)}`;

        // Upsert: update existing attendance or create new
        const existing = await prisma.attendance.findFirst({
            where: { employeeId: employee.id, date: dateStart },
        });

        if (existing) {
            // Don't overwrite if already regularized/approved
            if (existing.notes?.includes('"status":"APPROVED"')) {
                return NextResponse.json({ error: "This date has already been regularized" }, { status: 400 });
            }
            await prisma.attendance.update({
                where: { id: existing.id },
                data: { notes: notesStr, source: "regularization" },
            });
        } else {
            await prisma.attendance.create({
                data: {
                    date: dateStart,
                    employeeId: employee.id,
                    status: "absent",
                    source: "regularization",
                    notes: notesStr,
                },
            });
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
