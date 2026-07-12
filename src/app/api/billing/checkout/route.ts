/**
 * Billing API: Create Stripe Checkout Session
 *
 * POST /api/billing/checkout — Redirect tenant to Stripe Checkout
 * POST /api/billing/portal — Redirect to Stripe Customer Portal
 *
 * SECURITY: All DB access goes through `requireAuth()` + `auth.withDB()` so
 * reads are RLS-scoped to the caller's organization and protected by
 * sessionVersion / isActive / org-status checks enforced in requireAuth().
 *
 * Note: The `Plan` model is a global lookup table (not tenant-scoped), so we
 * read it via the platform (non-RLS) client. The subscription record is the
 * tenant-scoped artefact and is read through `auth.withDB()`.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { withPlatform } from "@/lib/prisma";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import { apiLogger } from "@/lib/logger";

/**
 * POST: Create a Stripe Checkout session for subscribing or upgrading
 */
export async function POST(request: NextRequest) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const body = await request.json();
        const { planSlug, billingCycle = "monthly" } = body;

        if (!planSlug) {
            return NextResponse.json(
                { error: "planSlug is required" },
                { status: 400 }
            );
        }

        // Only admins can manage billing
        if (!["admin", "super_admin"].includes(auth.role)) {
            return NextResponse.json(
                { error: "Only admins can manage billing" },
                { status: 403 }
            );
        }

        // Get the organization (RLS-scoped)
        const organization = await auth.withDB((db) =>
            db.organization.findUnique({
                where: { id: auth.organizationId },
                select: { id: true, name: true },
            }),
        );

        if (!organization) {
            return NextResponse.json(
                { error: "No organization found" },
                { status: 400 }
            );
        }

        // Get plan — global lookup table, not tenant-scoped. Use the platform
        // (non-RLS) client.
        const plan = await withPlatform((db) =>
            db.plan.findUnique({
                where: { slug: planSlug },
            }),
        );

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

        // Check if tenant already has a Stripe customer (RLS-scoped)
        const existingSub = await auth.withDB((db) =>
            db.subscription.findUnique({
                where: { organizationId: auth.organizationId },
            }),
        );

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
            organizationId: auth.organizationId,
            organizationName: organization.name,
            customerEmail: auth.email,
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
