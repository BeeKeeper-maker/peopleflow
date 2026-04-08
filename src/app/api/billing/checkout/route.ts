/**
 * Billing API: Create Stripe Checkout Session
 *
 * POST /api/billing/checkout — Redirect tenant to Stripe Checkout
 * POST /api/billing/portal — Redirect to Stripe Customer Portal
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import { apiLogger } from "@/lib/logger";

/**
 * POST: Create a Stripe Checkout session for subscribing or upgrading
 */
export async function POST(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.email) {
        return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const { planSlug, billingCycle = "monthly" } = body;

        if (!planSlug) {
            return NextResponse.json(
                { error: "planSlug is required" },
                { status: 400 }
            );
        }

        // Get user and org
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { organization: true },
        });

        if (!user?.organizationId || !user.organization) {
            return NextResponse.json(
                { error: "No organization found" },
                { status: 400 }
            );
        }

        // Only admins can manage billing
        if (!["admin", "super_admin"].includes(user.role)) {
            return NextResponse.json(
                { error: "Only admins can manage billing" },
                { status: 403 }
            );
        }

        // Get plan
        const plan = await prisma.plan.findUnique({
            where: { slug: planSlug },
        });

        if (!plan || !plan.isActive) {
            return NextResponse.json(
                { error: "Plan not found or inactive" },
                { status: 400 }
            );
        }

        // Get the right Stripe Price ID
        const stripePriceId =
            billingCycle === "yearly"
                ? plan.stripePriceIdYearly
                : plan.stripePriceIdMonthly;

        if (!stripePriceId) {
            return NextResponse.json(
                { error: "Stripe pricing not configured for this plan" },
                { status: 500 }
            );
        }

        // Check if tenant already has a Stripe customer
        const existingSub = await prisma.subscription.findUnique({
            where: { organizationId: user.organizationId },
        });

        // If they have an existing Stripe subscription, redirect to portal
        if (existingSub?.stripeCustomerId) {
            const portalSession = await createPortalSession({
                stripeCustomerId: existingSub.stripeCustomerId,
                returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
            });

            return NextResponse.json({ url: portalSession.url });
        }

        // Create new checkout session
        const appUrl =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const checkoutSession = await createCheckoutSession({
            organizationId: user.organizationId,
            organizationName: user.organization.name,
            customerEmail: user.email,
            stripePriceId,
            successUrl: `${appUrl}/settings/billing?checkout=success`,
            cancelUrl: `${appUrl}/settings/billing?checkout=cancel`,
        });

        return NextResponse.json({ url: checkoutSession.url });
    } catch (error) {
        apiLogger.error({ err: error }, "[BILLING_CHECKOUT] Error:");
        return NextResponse.json(
            { error: "Failed to create checkout session" },
            { status: 500 }
        );
    }
}
