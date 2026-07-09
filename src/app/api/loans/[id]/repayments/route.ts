import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/loans/[id]/repayments — List repayments for a loan
export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;

        // Verify loan belongs to org
        const loan = await auth.withDB((db) =>
            db.loan.findFirst({
                where: {
                    id,
                    employee: { organizationId: auth.organizationId },
                },
            }),
        );
        if (!loan) {
            return NextResponse.json({ error: "Loan not found" }, { status: 404 });
        }

        const repayments = await auth.withDB((db) =>
            db.loanRepayment.findMany({
                where: { loanId: id },
                orderBy: { installmentNo: "asc" },
            }),
        );

        return NextResponse.json(repayments);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_LOAN_REPAYMENTS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST /api/loans/[id]/repayments — Record a loan repayment
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;
        const json = await req.json();
        const { amount, principalPart, interestPart, paidDate, method, reference, note } = json;

        if (!amount || !paidDate) {
            return NextResponse.json(
                { error: "Amount and paid date are required" },
                { status: 400 }
            );
        }

        // Verify loan exists + belongs to org + is disbursed
        const loan = await auth.withDB((db) =>
            db.loan.findFirst({
                where: {
                    id,
                    employee: { organizationId: auth.organizationId },
                },
                include: { repayments: true },
            }),
        );

        if (!loan) {
            return NextResponse.json({ error: "Loan not found" }, { status: 404 });
        }

        if (loan.status !== "disbursed") {
            return NextResponse.json(
                { error: "Can only record repayments for disbursed loans" },
                { status: 400 }
            );
        }

        const installmentNo = loan.repayments.length + 1;
        const principal = principalPart || amount;
        const interest = interestPart || 0;

        // ✅ Validation: principal + interest must equal total amount
        // Previously, a client could inflate principalPart while paying a
        // tiny amount, "closing" the loan without fully paying it.
        if (Math.abs((principal + interest) - amount) > 0.01) {
            return NextResponse.json(
                {
                    error: `principalPart (${principal}) + interestPart (${interest}) must equal amount (${amount})`,
                    code: "INVALID_SPLIT",
                },
                { status: 400 },
            );
        }

        // ✅ Validation: principal cannot exceed remaining amount
        if (principal > loan.remainingAmount) {
            return NextResponse.json(
                {
                    error: `principalPart (${principal}) cannot exceed remaining loan amount (${loan.remainingAmount})`,
                    code: "PRINCIPAL_EXCEEDS_REMAINING",
                },
                { status: 400 },
            );
        }

        // ✅ Validation: method must be a valid enum value
        const validMethods = ["payroll", "bank_transfer", "cash"];
        const repaymentMethod = validMethods.includes(method) ? method : "payroll";

        // Create repayment and update loan balances (withDB wraps in transaction)
        const repayment = await auth.withDB(async (db) => {
            const created = await db.loanRepayment.create({
                data: {
                    installmentNo,
                    amount,
                    principalPart: principal,
                    interestPart: interest,
                    paidDate: new Date(paidDate),
                    method: repaymentMethod,
                    reference: reference || null,
                    note: note || null,
                    loanId: id,
                },
            });
            await db.loan.update({
                where: { id },
                data: {
                    paidAmount: { increment: amount },
                    remainingAmount: { decrement: principal },
                    // Auto-close loan if principal fully repaid
                    ...(Number(loan.remainingAmount) - principal <= 0.01
                        ? { status: "closed" }
                        : {}),
                },
            });
            return created;
        });

        return NextResponse.json(repayment);
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_LOAN_REPAYMENT_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
