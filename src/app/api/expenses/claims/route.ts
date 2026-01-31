import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const claimSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    amount: z.number().positive("Amount must be positive"),
    categoryId: z.string().min(1, "Category is required"),
    expenseDate: z.string().min(1, "Expense date is required"),
    receiptUrl: z.string().optional(),
    receiptName: z.string().optional(),
    status: z.enum(["draft", "submitted"]).default("draft"),
});

// Generate claim number
async function generateClaimNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.expenseClaim.count({
        where: {
            organizationId,
            claimNumber: { startsWith: `EXP-${year}` },
        },
    });
    return `EXP-${year}-${String(count + 1).padStart(4, "0")}`;
}

// GET - List expense claims
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
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
        // If manager, show team claims for approval (and own claims)
        else if (isManager && user.employee) {
            if (pending) {
                // For pending approvals, show team's submitted claims
                const reportees = await prisma.employee.findMany({
                    where: { reportingManagerId: user.employee.id },
                    select: { id: true },
                });
                whereClause.employeeId = { in: reportees.map(r => r.id) };
            } else if (employeeId) {
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
        console.error("Error fetching expense claims:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST - Create expense claim
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
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

        // Check max amount limit
        if (category.maxAmount && validatedData.amount > category.maxAmount) {
            return NextResponse.json({
                error: `Amount exceeds maximum limit of ${category.maxAmount} for this category`,
            }, { status: 400 });
        }

        // Check monthly limit
        if (category.monthlyLimit) {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const monthlyTotal = await prisma.expenseClaim.aggregate({
                where: {
                    employeeId: user.employee.id,
                    categoryId: validatedData.categoryId,
                    status: { not: "rejected" },
                    expenseDate: { gte: startOfMonth },
                },
                _sum: { amount: true },
            });

            const currentTotal = (monthlyTotal._sum.amount || 0) + validatedData.amount;
            if (currentTotal > category.monthlyLimit) {
                return NextResponse.json({
                    error: `Monthly limit of ${category.monthlyLimit} exceeded for this category`,
                }, { status: 400 });
            }
        }

        const claimNumber = await generateClaimNumber(user.organizationId);

        const claim = await prisma.expenseClaim.create({
            data: {
                claimNumber,
                title: validatedData.title,
                description: validatedData.description,
                amount: validatedData.amount,
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

        return NextResponse.json(claim, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Error creating expense claim:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
