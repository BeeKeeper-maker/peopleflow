import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import {
    STATUTORY_FORMS,
    generateStatutoryRegister,
    type FormCode,
} from "@/lib/statutory-registers";

// ═══════════════════════════════════════════════════════════════════════
// GET /api/reports/statutory
//   ?form=A          (A-K, required)
//   &month=7         (1-12, optional — defaults to current month)
//   &year=2026       (optional — defaults to current year)
//
// Returns the structured register data for the requested BLA 2006 form.
// Admin/HR only — these registers contain workforce-wide payroll info.
// ═══════════════════════════════════════════════════════════════════════

const VALID_FORMS = new Set<string>(STATUTORY_FORMS.map((f) => f.form));

export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const { searchParams } = new URL(req.url);
        const form = (searchParams.get("form") || "").toUpperCase();
        const monthParam = searchParams.get("month");
        const yearParam = searchParams.get("year");

        if (!form || !VALID_FORMS.has(form)) {
            return NextResponse.json(
                {
                    error: `Invalid 'form' parameter. Must be one of: ${STATUTORY_FORMS.map((f) => f.form).join(", ")}`,
                    code: "INVALID_FORM",
                },
                { status: 400 },
            );
        }

        const month = monthParam ? parseInt(monthParam, 10) : undefined;
        const year = yearParam ? parseInt(yearParam, 10) : undefined;

        if (month !== undefined && (Number.isNaN(month) || month < 1 || month > 12)) {
            return NextResponse.json(
                { error: "Invalid 'month' parameter. Must be 1-12.", code: "INVALID_MONTH" },
                { status: 400 },
            );
        }
        if (year !== undefined && (Number.isNaN(year) || year < 1900 || year > 2100)) {
            return NextResponse.json(
                { error: "Invalid 'year' parameter.", code: "INVALID_YEAR" },
                { status: 400 },
            );
        }

        const result = await auth.withDB((db) =>
            generateStatutoryRegister(
                db,
                form as FormCode,
                auth.organizationId,
                month,
                year,
            ),
        );

        return NextResponse.json(result);
    } catch (error) {
        apiLogger.error({ err: error }, "STATUTORY_REPORT_API_ERROR");
        return NextResponse.json(
            { error: "Failed to generate statutory register", code: "INTERNAL_ERROR" },
            { status: 500 },
        );
    }
}
