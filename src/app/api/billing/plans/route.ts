/**
 * Billing API: List Plans + Current Subscription
 *
 * GET /api/billing/plans — Returns all active plans and the caller's
 * current subscription status.
 *
 * Auth: Any authenticated tenant user (used by the "Upgrade" page to
 * render plan cards + the user's current plan badge).
 *
 * RLS: Uses `requireAuth()` + `auth.withDB()` so reads are scoped by
 * tenant via the row-level security policy. Previously this route used
 * `auth()` + raw `prisma.*` calls, which bypassed RLS and could leak
 * cross-tenant subscription data if the session was ever mis-issued.
 */

import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        // Plan rows are global (not tenant-scoped), but subscription is.
        // We fetch plans via withDB to keep a single RLS-aware DB client and
        // subscription via the same withDB call so both reads go through the
        // tenant-scoped role.
        const [plans, subscription] = await auth.withDB((db) =>
            Promise.all([
                db.plan.findMany({
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
                        maxCustomRoles: true,
                        features: true,
                        stripePriceIdMonthly: true,
                        stripePriceIdYearly: true,
                        sortOrder: true,
                    },
                }),
                db.subscription.findUnique({
                    where: { organizationId: auth.organizationId },
                    include: { plan: { select: { slug: true, name: true } } },
                }),
            ]),
        );

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
