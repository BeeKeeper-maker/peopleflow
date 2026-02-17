import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

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
        const loan = await prisma.loan.findFirst({
            where: {
                id,
                employee: { organizationId: auth.organizationId },
            },
        });
        if (!loan) {
            return NextResponse.json({ error: "Loan not found" }, { status: 404 });
        }

        const repayments = await prisma.loanRepayment.findMany({
            where: { loanId: id },
            orderBy: { installmentNo: "asc" },
        });

        return NextResponse.json(repayments);
    } catch (error) {
        console.error("GET_LOAN_REPAYMENTS_ERROR", error);
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
        const loan = await prisma.loan.findFirst({
            where: {
                id,
                employee: { organizationId: auth.organizationId },
            },
            include: { repayments: true },
        });

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

        // Create repayment and update loan balances in a transaction
        const [repayment] = await prisma.$transaction([
            prisma.loanRepayment.create({
                data: {
                    installmentNo,
                    amount,
                    principalPart: principal,
                    interestPart: interest,
                    paidDate: new Date(paidDate),
                    method: method || "payroll",
                    reference: reference || null,
                    note: note || null,
                    loanId: id,
                },
            }),
            prisma.loan.update({
                where: { id },
                data: {
                    paidAmount: { increment: amount },
                    remainingAmount: { decrement: principal },
                    // Auto-close loan if fully paid
                    ...(loan.remainingAmount - principal <= 0
                        ? { status: "closed" }
                        : {}),
                },
            }),
        ]);

        return NextResponse.json(repayment);
    } catch (error) {
        console.error("CREATE_LOAN_REPAYMENT_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
