import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { createApprovalRequest } from "@/lib/approval-engine";
import { calculateClaim, formatCurrency } from "@/lib/expense-engine";
import { apiLogger } from "@/lib/logger";

const claimSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    amount: z.number().positive("Amount must be positive").optional(), // optional for mileage/per_diem
    currency: z.string().min(3).max(5).default("BDT"),
    categoryId: z.string().min(1, "Category is required"),
    expenseDate: z.string().min(1, "Expense date is required"),
    receiptUrl: z.string().optional(),
    receiptName: z.string().optional(),
    status: z.enum(["draft", "submitted"]).default("draft"),
    // Mileage fields
    distance: z.number().positive().optional(),
    distanceUnit: z.enum(["km", "mile"]).optional(),
    // Per-diem fields
    perDiemDays: z.number().positive().optional(),
});

// Generate claim number with retry for race condition safety
async function generateClaimNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const count = await prisma.expenseClaim.count({
            where: {
                organizationId,
                claimNumber: { startsWith: `EXP-${year}` },
            },
        });
        const claimNumber = `EXP-${year}-${String(count + 1 + attempt).padStart(4, "0")}`;

        // Check if this number already exists
        const existing = await prisma.expenseClaim.findFirst({
            where: { claimNumber, organizationId },
        });

        if (!existing) return claimNumber;
    }

    // Fallback: use timestamp-based unique suffix
    return `EXP-${year}-${Date.now().toString(36).toUpperCase()}`;
}

// GET - List expense claims
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { employee: true },
        });

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        if (!user.isActive) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const employeeId = searchParams.get("employeeId");
        const pending = searchParams.get("pending") === "true";

        // Build where clause based on role
        const isManager = user.role === "manager";
        const isHR = ["admin", "hr_admin", "super_admin"].includes(user.role);

        let whereClause: any = {
            organizationId: user.organizationId,
        };

        if (status) {
            whereClause.status = status;
        }

        if (pending) {
            whereClause.status = "submitted";
        }

        // If regular employee, only show their claims
        if (!isHR && !isManager && user.employee) {
            whereClause.employeeId = user.employee.id;
        }
        // If manager, show only own claims or direct reportees' pending claims.
        // A manager-supplied employeeId must still be scoped to self/direct reportees;
        // otherwise a manager who guesses an employee id could list non-reportee claims.
        else if (isManager && user.employee) {
            const reportees = await prisma.employee.findMany({
                where: { organizationId: user.organizationId, reportingManagerId: user.employee.id },
                select: { id: true },
            });
            const reporteeIds = reportees.map(r => r.id);

            if (pending) {
                whereClause.employeeId = { in: reporteeIds };
            } else if (employeeId) {
                const allowedIds = new Set([user.employee.id, ...reporteeIds]);
                if (!allowedIds.has(employeeId)) {
                    return NextResponse.json([]);
                }
                whereClause.employeeId = employeeId;
            } else {
                // Show own claims
                whereClause.employeeId = user.employee.id;
            }
        }
        // HR can see all or filter by employee
        else if (isHR && employeeId) {
            whereClause.employeeId = employeeId;
        }

        const claims = await prisma.expenseClaim.findMany({
            where: whereClause,
            include: {
                category: true,
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        photoUrl: true,
                    },
                },
                approver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(claims);
    } catch (error) {
        apiLogger.error({ err: error }, "Error fetching expense claims:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST - Create expense claim
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { employee: true },
        });

        if (!user?.organizationId || !user.employee) {
            return NextResponse.json({ error: "Employee profile required" }, { status: 400 });
        }

        if (!user.isActive) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (user.employee.employmentStatus !== "active" || user.employee.deletedAt) {
            return NextResponse.json({ error: "Inactive employees cannot submit expenses" }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = claimSchema.parse(body);

        // Validate category exists and is active
        const category = await prisma.expenseCategory.findFirst({
            where: {
                id: validatedData.categoryId,
                organizationId: user.organizationId,
                isActive: true,
            },
        });

        if (!category) {
            return NextResponse.json({ error: "Invalid category" }, { status: 400 });
        }

        // ── Calculate claim using the expense engine ──
        // This handles: multi-currency conversion, mileage computation,
        // per-diem computation, and policy violation detection.
        let calculation;
        try {
            calculation = await calculateClaim({
                employeeId: user.employee.id,
                organizationId: user.organizationId,
                categoryId: validatedData.categoryId,
                categoryType: category.categoryType,
                amount: validatedData.amount,
                currency: validatedData.currency,
                distance: validatedData.distance,
                distanceUnit: validatedData.distanceUnit,
                perDiemDays: validatedData.perDiemDays,
                perDiemRate: category.perDiemRate ? Number(category.perDiemRate) : undefined,
                receiptUrl: validatedData.receiptUrl || null,
                expenseDate: new Date(validatedData.expenseDate),
            });
        } catch (calcError) {
            return NextResponse.json(
                { error: calcError instanceof Error ? calcError.message : "Calculation failed" },
                { status: 400 },
            );
        }

        // If there's a hard policy violation (over-limit, missing receipt, monthly limit),
        // block submission but allow draft
        if (calculation.policyViolation.hasViolation && validatedData.status === "submitted") {
            return NextResponse.json(
                {
                    error: `Policy violation: ${calculation.policyViolation.violationDescription}`,
                    code: "POLICY_VIOLATION",
                    violationType: calculation.policyViolation.violationType,
                },
                { status: 400 },
            );
        }

        const claimNumber = await generateClaimNumber(user.organizationId);

        const claim = await prisma.expenseClaim.create({
            data: {
                claimNumber,
                title: validatedData.title,
                description: validatedData.description,
                amount: calculation.amount,
                currency: calculation.currency,
                exchangeRate: calculation.exchangeRate,
                amountInBDT: calculation.amountInBDT,
                distance: validatedData.distance || null,
                distanceUnit: validatedData.distanceUnit || null,
                perDiemDays: validatedData.perDiemDays || null,
                perDiemRate: category.perDiemRate || null,
                policyViolation: calculation.policyViolation.violationDescription || null,
                policyViolationType: calculation.policyViolation.violationType || null,
                expenseDate: new Date(validatedData.expenseDate),
                receiptUrl: validatedData.receiptUrl,
                receiptName: validatedData.receiptName,
                status: validatedData.status,
                submittedAt: validatedData.status === "submitted" ? new Date() : null,
                categoryId: validatedData.categoryId,
                employeeId: user.employee.id,
                organizationId: user.organizationId,
            },
            include: {
                category: true,
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        // ── ✅ NEW: Create Stateful Approval Request when submitted ──
        if (validatedData.status === "submitted") {
            try {
                const formattedAmount = formatCurrency(calculation.amountInBDT, "BDT");

                await createApprovalRequest({
                    entityType: "expense",
                    entityId: claim.id,
                    requestTitle: `Expense: ${validatedData.title} (${formattedAmount})`,
                    requesterId: user.employee.id,
                    organizationId: user.organizationId,
                    priority: calculation.amountInBDT >= 50000 ? "high" : "normal",
                });
            } catch (approvalError) {
                apiLogger.error({ err: approvalError }, "EXPENSE_APPROVAL_REQUEST_ERROR");
            }
        }

        return NextResponse.json(claim, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        apiLogger.error({ err: error }, "Error creating expense claim:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
