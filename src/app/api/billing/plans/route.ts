import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";

export async function GET() {
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { organizationId: true },
        });

        if (!user?.organizationId) {
            return NextResponse.json({ error: "No organization found" }, { status: 400 });
        }

        const [plans, subscription] = await Promise.all([
            prisma.plan.findMany({
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    priceMonthly: true,
                    priceYearly: true,
                    currency: true,
                    maxEmployees: true,
                    maxAdmins: true,
                    maxBranches: true,
                    maxDevices: true,
                    maxStorageMB: true,
                    features: true,
                    stripePriceIdMonthly: true,
                    stripePriceIdYearly: true,
                    sortOrder: true,
                },
            }),
            prisma.subscription.findUnique({
                where: { organizationId: user.organizationId },
                include: { plan: { select: { slug: true, name: true } } },
            }),
        ]);

        return NextResponse.json({
            plans: plans.map((plan) => ({
                ...plan,
                checkoutReady: Boolean(plan.stripePriceIdMonthly || plan.stripePriceIdYearly),
                stripePriceIdMonthly: undefined,
                stripePriceIdYearly: undefined,
            })),
            currentPlanSlug: subscription?.plan.slug ?? null,
            currentPlanName: subscription?.plan.name ?? null,
            subscriptionStatus: subscription?.status ?? null,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "[BILLING_PLANS] Error:");
        return NextResponse.json({ error: "Failed to fetch billing plans" }, { status: 500 });
    }
}
