import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { calculateFinalSettlement } from "@/lib/final-settlement-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Final Settlement API
//
// GET  /api/employees/:id/final-settlement?lastWorkingDate=…&separationType=…
// POST /api/employees/:id/final-settlement  { lastWorkingDate, separationType, noticeGiven, noticeDaysServed }
//
// Wraps the previously-dead-code `calculateFinalSettlement` engine so HR can
// preview full & final settlement figures (pro-rated salary, leave encashment,
// gratuity, notice pay, PF withdrawal, loan recovery) before offboarding an
// employee. The engine itself is BLA 2006 compliant (Sections 23, 26, 27, 100).
//
// Auth: requireAdminOrHR (matches the DELETE /api/employees/:id offboarding
// endpoint — final settlement is a privileged HR operation).
// ─────────────────────────────────────────────────────────────────────────────

type SeparationType =
    | "resignation"
    | "termination"
    | "retirement"
    | "death"
    | "dismissal";

const VALID_SEPARATION_TYPES: ReadonlySet<SeparationType> = new Set([
    "resignation",
    "termination",
    "retirement",
    "death",
    "dismissal",
]);

/**
 * Parse + validate the shared settlement input fields from either a query
 * string (GET) or a JSON body (POST). Returns null on a validation error
 * along with an HTTP-friendly message via the `error` out-param.
 */
function parseSettlementInput(args: {
    lastWorkingDate?: string | null;
    separationType?: string | null;
    noticeGiven?: string | boolean | null;
    noticeDaysServed?: string | number | null;
}): {
    ok: true;
    lastWorkingDate: Date;
    separationType: SeparationType;
    noticeGiven: boolean;
    noticeDaysServed: number;
} | { ok: false; error: string; status: number } {
    const now = new Date();
    const lastWorkingDate = args.lastWorkingDate
        ? new Date(args.lastWorkingDate)
        : now;
    if (Number.isNaN(lastWorkingDate.getTime())) {
        return { ok: false, error: "Invalid lastWorkingDate", status: 422 };
    }

    const separationTypeRaw = args.separationType || "resignation";
    if (!VALID_SEPARATION_TYPES.has(separationTypeRaw as SeparationType)) {
        return {
            ok: false,
            error: `Invalid separationType. Must be one of: ${[...VALID_SEPARATION_TYPES].join(", ")}`,
            status: 422,
        };
    }

    const noticeGiven =
        typeof args.noticeGiven === "boolean"
            ? args.noticeGiven
            : args.noticeGiven === undefined || args.noticeGiven === null
              ? false
              : args.noticeGiven === "true";

    const noticeDaysServedRaw =
        typeof args.noticeDaysServed === "number"
            ? args.noticeDaysServed
            : Number(args.noticeDaysServed ?? 0);
    if (Number.isNaN(noticeDaysServedRaw) || noticeDaysServedRaw < 0) {
        return {
            ok: false,
            error: "noticeDaysServed must be a non-negative number",
            status: 422,
        };
    }

    return {
        ok: true,
        lastWorkingDate,
        separationType: separationTypeRaw as SeparationType,
        noticeGiven,
        noticeDaysServed: noticeDaysServedRaw,
    };
}

/**
 * Verify the employee belongs to the caller's org before computing settlement.
 * The engine itself fetches the employee via the global prisma client (no
 * RLS), so this check is what enforces tenant isolation.
 */
async function fetchEmployeeForOrg(employeeId: string, organizationId: string) {
    // Imported lazily inside the request handler so the module-level mock in
    // tests doesn't shadow the real prisma import for unrelated test files.
    const { prisma } = await import("@/lib/prisma");
    return prisma.employee.findFirst({
        where: { id: employeeId, organizationId, deletedAt: null },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            employmentStatus: true,
            employmentType: true,
            joiningDate: true,
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees/:id/final-settlement
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);

        const parsed = parseSettlementInput({
            lastWorkingDate: searchParams.get("lastWorkingDate"),
            separationType: searchParams.get("separationType"),
            noticeGiven: searchParams.get("noticeGiven"),
            noticeDaysServed: searchParams.get("noticeDaysServed"),
        });
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: parsed.status });
        }

        const employee = await fetchEmployeeForOrg(id, auth.organizationId);
        if (!employee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        const settlement = await calculateFinalSettlement({
            employeeId: id,
            lastWorkingDate: parsed.lastWorkingDate,
            separationType: parsed.separationType,
            noticeGiven: parsed.noticeGiven,
            noticeDaysServed: parsed.noticeDaysServed,
        });

        return NextResponse.json({ settlement });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "FINAL_SETTLEMENT_GET_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employees/:id/final-settlement
//
// Accepts the same fields as the GET query params but via JSON body, allowing
// the caller to explicitly mark separationType / noticeDaysServed (e.g. when
// HR clicks "Compute Settlement" from the offboarding wizard).
//
// Note: this endpoint computes + returns the settlement. It does NOT mutate
// employee state or persist a settlement record — that's a separate concern
// (the offboarding DELETE endpoint already handles status transitions).
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;

        let body: Record<string, unknown> = {};
        try {
            body = await req.json();
        } catch {
            // Empty body is allowed — defaults kick in below.
        }

        const parsed = parseSettlementInput({
            lastWorkingDate:
                typeof body.lastWorkingDate === "string" ? body.lastWorkingDate : null,
            separationType:
                typeof body.separationType === "string" ? body.separationType : null,
            noticeGiven:
                typeof body.noticeGiven === "boolean" ? body.noticeGiven : null,
            noticeDaysServed:
                typeof body.noticeDaysServed === "number"
                    ? body.noticeDaysServed
                    : typeof body.noticeDaysServed === "string"
                      ? body.noticeDaysServed
                      : null,
        });
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: parsed.status });
        }

        const employee = await fetchEmployeeForOrg(id, auth.organizationId);
        if (!employee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        const settlement = await calculateFinalSettlement({
            employeeId: id,
            lastWorkingDate: parsed.lastWorkingDate,
            separationType: parsed.separationType,
            noticeGiven: parsed.noticeGiven,
            noticeDaysServed: parsed.noticeDaysServed,
        });

        apiLogger.info(
            {
                employeeId: id,
                separationType: parsed.separationType,
                netPayable: settlement.netPayable,
                actorUserId: auth.userId,
            },
            "Final settlement computed via POST",
        );

        return NextResponse.json({ settlement });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "FINAL_SETTLEMENT_POST_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
