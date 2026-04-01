/**
 * Stripe Webhook Handler
 *
 * Handles all incoming Stripe webhook events for subscription lifecycle:
 * - checkout.session.completed → Activate subscription
 * - invoice.payment_succeeded → Record payment, extend period
 * - invoice.payment_failed → Mark past_due, trigger grace period
 * - customer.subscription.updated → Plan changes
 * - customer.subscription.deleted → Cancellation
 * - customer.subscription.trial_will_end → Trial ending warning
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, generateInvoiceNumber } from "@/lib/stripe";
import { invalidateSubscription, invalidateOrgStatus } from "@/lib/redis";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json(
            { error: "Missing stripe-signature header" },
            { status: 400 }
        );
    }

    // Verify webhook authenticity
    let event: Stripe.Event;
    try {
        event = verifyWebhookSignature(body, signature);
    } catch (err) {
        console.error("[STRIPE_WEBHOOK] Signature verification failed:", err);
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
        );
    }

    console.log(`[STRIPE_WEBHOOK] Received: ${event.type}`);

    try {
        switch (event.type) {
            case "checkout.session.completed":
                await handleCheckoutCompleted(
                    event.data.object as Stripe.Checkout.Session
                );
                break;

            case "invoice.payment_succeeded":
                await handlePaymentSucceeded(
                    event.data.object as Stripe.Invoice
                );
                break;

            case "invoice.payment_failed":
                await handlePaymentFailed(
                    event.data.object as Stripe.Invoice
                );
                break;

            case "customer.subscription.updated":
                await handleSubscriptionUpdated(
                    event.data.object as Stripe.Subscription
                );
                break;

            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(
                    event.data.object as Stripe.Subscription
                );
                break;

            case "customer.subscription.trial_will_end":
                await handleTrialWillEnd(
                    event.data.object as Stripe.Subscription
                );
                break;

            default:
                console.log(
                    `[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`
                );
        }
    } catch (error) {
        console.error(`[STRIPE_WEBHOOK] Handler error for ${event.type}:`, error);
        // Return 200 to prevent Stripe retries on application errors
        // The error is logged for investigation
    }

    return NextResponse.json({ received: true });
}

// ============================================
// Event Handlers
// ============================================

/**
 * checkout.session.completed
 * Called when a customer completes the Stripe Checkout flow.
 * Links Stripe customer/subscription to our Organization.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const organizationId = session.metadata?.organizationId;
    if (!organizationId) {
        console.error("[STRIPE_WEBHOOK] No organizationId in checkout metadata");
        return;
    }

    const stripeSubscriptionId = session.subscription as string;
    const stripeCustomerId = session.customer as string;

    // Update our subscription record
    const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
    });

    if (subscription) {
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: "active",
                stripeCustomerId,
                stripeSubscriptionId,
            },
        });
    }

    // Update org status
    await prisma.organization.update({
        where: { id: organizationId },
        data: { status: "active" },
    });

    // Invalidate caches
    await invalidateSubscription(organizationId);
    await invalidateOrgStatus(organizationId);

    console.log(
        `[STRIPE_WEBHOOK] Checkout completed for org: ${organizationId}`
    );
}

/**
 * invoice.payment_succeeded
 * Called when an invoice is paid. Updates subscription period.
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const stripeSubId = (invoice as any).subscription as string;
    if (!stripeSubId) return;

    const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSubId },
    });

    if (!subscription) {
        console.error(
            `[STRIPE_WEBHOOK] No subscription found for Stripe sub: ${stripeSubId}`
        );
        return;
    }

    // Idempotency check — don't create duplicate invoices
    const existingInvoice = await prisma.invoice.findFirst({
        where: { stripeInvoiceId: invoice.id },
    });

    if (existingInvoice) {
        console.log(`[STRIPE_WEBHOOK] Invoice ${invoice.id} already recorded`);
        return;
    }

    // Get next invoice number
    const invoiceCount = await prisma.invoice.count({
        where: { subscriptionId: subscription.id },
    });

    // Record the payment
    await prisma.$transaction([
        prisma.invoice.create({
            data: {
                invoiceNumber: generateInvoiceNumber(invoiceCount + 1),
                status: "paid",
                amount: invoice.amount_paid,
                currency: invoice.currency.toUpperCase(),
                stripeInvoiceId: invoice.id,
                paymentMethod: "card",
                periodStart: new Date((invoice.period_start ?? 0) * 1000),
                periodEnd: new Date((invoice.period_end ?? 0) * 1000),
                dueDate: new Date((invoice.due_date ?? invoice.period_end ?? 0) * 1000),
                paidAt: new Date(),
                subscriptionId: subscription.id,
            },
        }),
        prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: "active",
                currentPeriodStart: new Date(
                    (invoice.period_start ?? 0) * 1000
                ),
                currentPeriodEnd: new Date((invoice.period_end ?? 0) * 1000),
            },
        }),
    ]);

    // Make sure org is active
    await prisma.organization.update({
        where: { id: subscription.organizationId },
        data: { status: "active", suspendedAt: null, suspendedReason: null },
    });

    // Invalidate caches
    await invalidateSubscription(subscription.organizationId);
    await invalidateOrgStatus(subscription.organizationId);

    console.log(
        `[STRIPE_WEBHOOK] Payment succeeded for org: ${subscription.organizationId}`
    );
}

/**
 * invoice.payment_failed
 * Called when a payment attempt fails. Starts the grace period cascade.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const stripeSubId = (invoice as any).subscription as string;
    if (!stripeSubId) return;

    const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSubId },
    });

    if (!subscription) return;

    // Get attempt count from Stripe
    const attemptCount = invoice.attempt_count ?? 1;

    // Record failed invoice
    const existingInvoice = await prisma.invoice.findFirst({
        where: { stripeInvoiceId: invoice.id },
    });

    if (!existingInvoice) {
        const invoiceCount = await prisma.invoice.count({
            where: { subscriptionId: subscription.id },
        });

        await prisma.invoice.create({
            data: {
                invoiceNumber: generateInvoiceNumber(invoiceCount + 1),
                status: "failed",
                amount: invoice.amount_due,
                currency: invoice.currency.toUpperCase(),
                stripeInvoiceId: invoice.id,
                failedAt: new Date(),
                failureReason:
                    invoice.last_finalization_error?.message ||
                    "Payment declined",
                periodStart: new Date((invoice.period_start ?? 0) * 1000),
                periodEnd: new Date((invoice.period_end ?? 0) * 1000),
                dueDate: new Date(
                    (invoice.due_date ?? invoice.period_end ?? 0) * 1000
                ),
                subscriptionId: subscription.id,
            },
        });
    }

    // Grace period cascade:
    // Attempt 1 (Day 0): Mark past_due, show warning banner
    // Attempt 3+ (Day 7): Suspend the organization
    if (attemptCount >= 3) {
        // SUSPEND — Day 7+ of failed payments
        await prisma.$transaction([
            prisma.subscription.update({
                where: { id: subscription.id },
                data: { status: "suspended" },
            }),
            prisma.organization.update({
                where: { id: subscription.organizationId },
                data: {
                    status: "suspended",
                    suspendedAt: new Date(),
                    suspendedReason: "payment_failed",
                },
            }),
        ]);

        console.log(
            `[STRIPE_WEBHOOK] SUSPENDED org: ${subscription.organizationId} (payment failed ${attemptCount} times)`
        );
    } else {
        // WARN — Day 0-6
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: "past_due" },
        });

        console.log(
            `[STRIPE_WEBHOOK] Payment failed (attempt ${attemptCount}) for org: ${subscription.organizationId}`
        );
    }

    // Invalidate caches
    await invalidateSubscription(subscription.organizationId);
    await invalidateOrgStatus(subscription.organizationId);
}

/**
 * customer.subscription.updated
 * Called when a subscription is changed (plan upgrade/downgrade).
 */
async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
    const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!subscription) return;

    // Get the new price ID from Stripe
    const newPriceId = stripeSub.items.data[0]?.price.id;

    if (newPriceId) {
        // Find matching plan
        const plan = await prisma.plan.findFirst({
            where: {
                OR: [
                    { stripePriceIdMonthly: newPriceId },
                    { stripePriceIdYearly: newPriceId },
                ],
            },
        });

        if (plan) {
            const billingCycle = plan.stripePriceIdYearly === newPriceId
                ? "yearly"
                : "monthly";

            await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    planId: plan.id,
                    billingCycle,
                    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                    currentPeriodStart: new Date(
                        (stripeSub as any).current_period_start * 1000
                    ),
                    currentPeriodEnd: new Date(
                        (stripeSub as any).current_period_end * 1000
                    ),
                },
            });

            console.log(
                `[STRIPE_WEBHOOK] Subscription updated for org: ${subscription.organizationId}, new plan: ${plan.slug}`
            );
        }
    }

    // Invalidate cache — plan limits may have changed
    await invalidateSubscription(subscription.organizationId);
}

/**
 * customer.subscription.deleted
 * Called when a subscription is canceled (immediate or at period end).
 */
async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!subscription) return;

    await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "canceled" },
    });

    // Don't suspend immediately — data preserved for 30 days
    // A background CRON will handle deactivation after 30 days

    console.log(
        `[STRIPE_WEBHOOK] Subscription canceled for org: ${subscription.organizationId}`
    );

    await invalidateSubscription(subscription.organizationId);
}

/**
 * customer.subscription.trial_will_end
 * Called 3 days before a trial ends.
 */
async function handleTrialWillEnd(stripeSub: Stripe.Subscription) {
    const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSub.id },
    });

    if (!subscription) return;

    console.log(
        `[STRIPE_WEBHOOK] Trial ending in 3 days for org: ${subscription.organizationId}`
    );

    // TODO: Send email notification about trial ending
    // await sendTemplateEmail(orgAdminEmail, "trialEnding", { daysLeft: 3 });
}
