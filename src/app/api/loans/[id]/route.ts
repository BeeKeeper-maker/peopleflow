import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

// PUT /api/loans/[id] — Update loan status
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;
        const json = await req.json();

        const existing = await prisma.loan.findFirst({
            where: { id },
            include: { employee: { select: { organizationId: true } } },
        });

        if (!existing || existing.employee.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Loan not found" }, { status: 404 });
        }

        const data: Record<string, unknown> = {};

        if (json.status) {
            data.status = json.status;
            if (json.status === "approved") {
                data.approvedAt = new Date();
                data.approverId = auth.employeeId || null;
            }
            if (json.status === "disbursed") {
                data.disbursedAt = new Date();
                data.disbursedAmount = existing.amount;
            }
        }

        const loan = await prisma.loan.update({
            where: { id },
            data,
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, employeeCode: true },
                },
            },
        });

        return NextResponse.json(loan);
    } catch (error) {
        console.error("UPDATE_LOAN_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

// DELETE /api/loans/[id] — Delete a loan
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;

        const existing = await prisma.loan.findFirst({
            where: { id },
            include: { employee: { select: { organizationId: true } } },
        });

        if (!existing || existing.employee.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Loan not found" }, { status: 404 });
        }

        await prisma.loan.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE_LOAN_ERROR", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
