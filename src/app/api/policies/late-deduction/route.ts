import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";

// GET /api/policies/late-deduction — Get active late deduction policy with tiers
export async function GET(req: NextRequest) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const policies = await prisma.lateDeductionPolicy.findMany({
            where: { organizationId: auth.organizationId },
            include: {
                tiers: { orderBy: { tierOrder: "asc" } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ data: policies });
    } catch (error) {
        apiLogger.error({ err: error }, "LATE_POLICY_GET_ERROR");
        return NextResponse.json({ error: "Failed to fetch late deduction policy" }, { status: 500 });
    }
}

// POST /api/policies/late-deduction — Create a new late deduction policy with tiers
export async function POST(req: NextRequest) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const body = await req.json();

        const policy = await prisma.$transaction(async (tx) => {
            // Deactivate any existing active policy
            await tx.lateDeductionPolicy.updateMany({
                where: { organizationId: auth.organizationId, isActive: true },
                data: { isActive: false },
            });

            // Create new policy
            const newPolicy = await tx.lateDeductionPolicy.create({
                data: {
                    organizationId: auth.organizationId,
                    name: body.name,
                    lateThresholdMinutes: body.lateThresholdMinutes || 10,
                    isActive: true,
                },
            });

            // Create tiers
            if (body.tiers && body.tiers.length > 0) {
                await tx.lateDeductionTier.createMany({
                    data: body.tiers.map((tier: any, index: number) => ({
                        policyId: newPolicy.id,
                        tierOrder: index + 1,
                        name: tier.name,
                        fromCount: tier.fromCount,
                        toCount: tier.toCount,
                        deductionType: tier.deductionType,
                        deductionValue: tier.deductionValue || 0,
                        issueWarning: tier.issueWarning ?? false,
                        warningLevel: tier.warningLevel || "verbal",
                    })),
                });
            }

            return tx.lateDeductionPolicy.findUnique({
                where: { id: newPolicy.id },
                include: { tiers: { orderBy: { tierOrder: "asc" } } },
            });
        });

        return NextResponse.json({ data: policy }, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "LATE_POLICY_CREATE_ERROR");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create policy" },
            { status: 500 }
        );
    }
}
