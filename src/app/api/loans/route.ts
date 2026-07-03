import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { createApprovalRequest } from "@/lib/approval-engine";
import { apiLogger } from "@/lib/logger";

// GET /api/loans — List loans for the organization
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");

        const where: Record<string, unknown> = {
            employee: { organizationId: auth.organizationId },
        };

        const isHR = ["super_admin", "admin", "hr_admin"].includes(auth.role);
        const isManager = auth.role === "manager";

        // Employees can only see their own loans. Managers can see own loans and direct reportees only.
        if (!isHR) {
            if (!auth.employeeId) {
                return NextResponse.json([]);
            }

            if (isManager) {
                where.OR = [
                    { employeeId: auth.employeeId },
                    { employee: { organizationId: auth.organizationId, reportingManagerId: auth.employeeId } },
                ];
            } else {
                where.employeeId = auth.employeeId;
            }
        }

        if (status) where.status = status;

        const loans = await prisma.loan.findMany({
            where,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, employeeCode: true },
                },
                approver: {
                    select: { id: true, firstName: true, lastName: true },
                },
                repayments: {
                    orderBy: { installmentNo: "asc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(loans);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_LOANS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// POST /api/loans — Create a loan
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const json = await req.json();
        const { employeeId, type, amount, interestRate, tenure, reason } = json;

        if (!employeeId || !type || !amount || !tenure) {
            return NextResponse.json(
                { error: "Employee, type, amount, and tenure are required" },
                { status: 400 }
            );
        }

        const isHR = ["super_admin", "admin", "hr_admin"].includes(auth.role);
        const isManager = auth.role === "manager";

        if (!isHR && !auth.employeeId) {
            return NextResponse.json({ error: "Employee profile not found" }, { status: 400 });
        }

        if (!isHR && !isManager && employeeId !== auth.employeeId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Verify employee belongs to org and is within the caller's allowed scope.
        // Employees may request only their own loan; managers may request for self/direct reportees only.
        const employee = await prisma.employee.findFirst({
            where: {
                id: employeeId,
                organizationId: auth.organizationId,
                ...(!isHR && isManager ? { OR: [{ id: auth.employeeId }, { reportingManagerId: auth.employeeId }] } : {}),
            },
            select: { id: true, firstName: true, lastName: true },
        });
        if (!employee) {
            return NextResponse.json({ error: isManager ? "Employee not found" : "Employee not found" }, { status: 404 });
        }

        const rate = interestRate || 0;
        // EMI calculation: use standard reducing-balance amortization formula
        // (the same formula banks use). The previous simple-interest formula
        // produced EMI values that didn't match bank statements.
        //
        // Formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1)
        //   where P = principal, r = monthly rate (annual/12/100), n = tenure months
        //
        // For zero-interest loans (rate=0): EMI = P / n (simple division)
        const monthlyRate = rate > 0 ? rate / 100 / 12 : 0;
        let emiAmount: number;
        if (monthlyRate > 0) {
            const pow = Math.pow(1 + monthlyRate, tenure);
            emiAmount = (amount * monthlyRate * pow) / (pow - 1);
        } else {
            emiAmount = amount / tenure;
        }

        const loan = await prisma.loan.create({
            data: {
                type,
                amount,
                interestRate: rate,
                tenure,
                emiAmount: Math.round(emiAmount * 100) / 100,
                remainingAmount: amount,
                reason: reason || null,
                employeeId,
            },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, employeeCode: true },
                },
            },
        });

        // ── ✅ NEW: Create Stateful Approval Request ──
        try {
            const formattedAmount = new Intl.NumberFormat("en-BD", {
                style: "currency", currency: "BDT", maximumFractionDigits: 0,
            }).format(amount);

            await createApprovalRequest({
                entityType: "loan",
                entityId: loan.id,
                requestTitle: `${type} Loan: ${formattedAmount} (${tenure} months)`,
                requesterId: employeeId,
                organizationId: auth.organizationId,
                priority: amount >= 500000 ? "high" : "normal",
            });
        } catch (approvalError) {
            apiLogger.error({ err: approvalError }, "LOAN_APPROVAL_REQUEST_ERROR");
        }

        return NextResponse.json(loan);
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_LOAN_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
