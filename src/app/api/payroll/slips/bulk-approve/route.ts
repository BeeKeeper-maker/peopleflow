import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { payrollLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

/**
 * POST /api/payroll/slips/bulk-approve — Approve multiple salary slips
 *
 * Body:
 *   {
 *     "slipIds": ["slip_1", "slip_2", ...],
 *     "month": 7,        // optional: filter by month (1-12)
 *     "year": 2026       // optional: filter by year
 *   }
 *
 * Behavior:
 *   - If `slipIds` is provided, approve exactly those slips.
 *   - If `slipIds` is omitted but `month` + `year` are provided, approve
 *     ALL draft slips for the authed organization in that month/year.
 *   - Slips that are already approved/paid are skipped (not an error).
 *   - Returns a summary of approved / skipped / not-found counts.
 *
 * Authorization: admin / hr_admin / super_admin only.
 */
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return NextResponse.json(
            { error: "Forbidden", code: "ACCESS_DENIED" },
            { status: 403 },
        );
    }

    try {
        const body = await req.json().catch(() => ({}));
        const slipIds = Array.isArray(body?.slipIds)
            ? body.slipIds.filter((id: unknown) => typeof id === "string")
            : null;
        const month =
            typeof body?.month === "number" && body.month >= 1 && body.month <= 12
                ? body.month
                : null;
        const year = typeof body?.year === "number" && body.year >= 2020 ? body.year : null;

        if (!slipIds && (month === null || year === null)) {
            return NextResponse.json(
                {
                    error:
                        "Either slipIds (array) OR both month + year must be provided",
                    code: "VALIDATION_ERROR",
                },
                { status: 400 },
            );
        }

        // Build the where clause. Always scope to the authed org.
        const where: Record<string, unknown> = {
            status: "draft",
            employee: { organizationId: auth.organizationId },
        };

        if (slipIds && slipIds.length > 0) {
            where.id = { in: slipIds };
        } else {
            where.month = month;
            where.year = year;
        }

        // Fetch matching slips (for audit + count)
        const slipsToApprove = await auth.withDB((db) => db.salarySlip.findMany({
            where,
            select: {
                id: true,
                employeeId: true,
                month: true,
                year: true,
                status: true,
                netSalary: true,
            },
        }));

        if (slipsToApprove.length === 0) {
            return NextResponse.json({
                success: true,
                approved: 0,
                skipped: 0,
                message: "No draft salary slips found matching the criteria.",
            });
        }

        // Bulk update all matching slips to "approved"
        const result = await auth.withDB((db) => db.salarySlip.updateMany({
            where: { id: { in: slipsToApprove.map((s) => s.id) } },
            data: { status: "approved" },
        }));

        // Audit log (one entry summarizing the bulk action)
        await createAuditLog({
            organizationId: auth.organizationId,
            action: "approve",
            entityType: "SalarySlip",
            entityId: "bulk",
            oldValues: { count: slipsToApprove.length, status: "draft" },
            newValues: {
                count: result.count,
                status: "approved",
                slipIds: slipsToApprove.map((s) => s.id),
                filter: slipIds ? { slipIds } : { month, year },
            },
            userId: auth.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            payrollLogger.error({ err }, "Failed to write audit log for bulk slip approval");
        });

        payrollLogger.info(
            { approved: result.count, approverUserId: auth.userId, filter: slipIds ? "byIds" : "byMonth" },
            "Bulk salary slip approval",
        );

        return NextResponse.json({
            success: true,
            approved: result.count,
            skipped: slipsToApprove.length - result.count,
            slipIds: slipsToApprove.map((s) => s.id),
            message: `${result.count} salary slip(s) approved successfully.`,
        });
    } catch (error) {
        payrollLogger.error({ err: error }, "BULK_APPROVE_SLIPS_ERROR");
        return NextResponse.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 },
        );
    }
}
