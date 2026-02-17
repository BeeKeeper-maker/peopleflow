import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

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

        // Non-admin users can only see their own loans
        if (!["super_admin", "admin", "hr_admin", "manager"].includes(auth.role)) {
            if (auth.employeeId) {
                where.employeeId = auth.employeeId;
            } else {
                // No employee record linked — return empty
                return NextResponse.json([]);
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
        console.error("GET_LOANS_ERROR", error);
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

        // Verify employee belongs to org
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, organizationId: auth.organizationId },
        });
        if (!employee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        const rate = interestRate || 0;
        const emiAmount = rate > 0
            ? (amount * (1 + (rate / 100) * (tenure / 12))) / tenure
            : amount / tenure;

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

        return NextResponse.json(loan);
    } catch (error) {
        console.error("CREATE_LOAN_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
