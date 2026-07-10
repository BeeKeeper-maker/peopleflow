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
import { prisma, withPlatform } from "@/lib/prisma";
import { verifyWebhookSignature, generateInvoiceNumber } from "@/lib/stripe";
import { getRedis, invalidateSubscription, invalidateOrgStatus } from "@/lib/redis";
import type Stripe from "stripe";
import { billingLogger } from "@/lib/logger";

const STRIPE_EVENT_IDEMPOTENCY_TTL_SECONDS = 30 * 24 * 60 * 60;
const STRIPE_EVENT_PROCESSING_TTL_SECONDS = 10 * 60;

/** Extract subscription ID from an invoice — handles both old and new Stripe API shapes */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
    // New Stripe API (2025+): subscription lives under parent.subscription_details
    const subDetail = invoice.parent?.subscription_details?.subscription;
    if (subDetail) {
        return typeof subDetail === "string" ? subDetail : subDetail.id;
    }
    return undefined;
}

async function claimStripeEvent(eventId: string): Promise<boolean> {
    try {
        const result = await getRedis().set(
            `stripe:event:${eventId}`,
            "processing",
            "EX",
            STRIPE_EVENT_PROCESSING_TTL_SECONDS,
            "NX"
        );
        return result === "OK";
    } catch (error) {
        billingLogger.warn(
            { err: error, eventId },
            "[STRIPE_WEBHOOK] Redis idempotency check unavailable; processing event"
        );
        return true;
    }
}

async function markStripeEventProcessed(eventId: string): Promise<void> {
    try {
        await getRedis().set(
            `stripe:event:${eventId}`,
            "processed",
            "EX",
            STRIPE_EVENT_IDEMPOTENCY_TTL_SECONDS
        );
    } catch (error) {
        billingLogger.warn(
            { err: error, eventId },
            "[STRIPE_WEBHOOK] Could not persist processed event id"
        );
    }
}

async function releaseStripeEventClaim(eventId: string): Promise<void> {
    try {
        await getRedis().del(`stripe:event:${eventId}`);
    } catch (error) {
        billingLogger.warn(
            { err: error, eventId },
            "[STRIPE_WEBHOOK] Could not release failed event claim"
        );
    }
}

/**
 * Persist a Stripe event id to the DB idempotency ledger.
 *
 * Uses `withPlatform()` because Stripe webhooks are cross-tenant —
 * there is no organization context at webhook time, so we bypass RLS.
 *
 * Returns:
 *   - "inserted"  — first time we've seen this event id (normal path)
 *   - "duplicate" — another worker already inserted it (P2002 race).
 *                   This is expected during concurrent processing and
 *                   is treated as success.
 *   - "error"     — DB write failed for any other reason. The caller
 *                   must NOT mark Redis as processed and must return 500
 *                   so Stripe retries; otherwise the event would be
 *                   lost after Redis eviction.
 */
async function persistStripeEvent(
    eventId: string,
    eventType: string
): Promise<"inserted" | "duplicate" | "error"> {
    try {
        await withPlatform((db) =>
            db.stripeEvent.create({
                data: { eventId, eventType },
            })
        );
        return "inserted";
    } catch (err: unknown) {
        // P2002 = unique constraint violation. Another worker beat us to
        // the insert — race condition between two concurrent deliveries.
        // The event was already processed, so this is a no-op success.
        const prismaError = err as { code?: string };
        if (prismaError.code === "P2002") {
            billingLogger.info(
                { eventId, eventType },
                "[STRIPE_WEBHOOK] StripeEvent already persisted by concurrent worker (P2002)"
            );
            return "duplicate";
        }
        billingLogger.error(
            { err: err, eventId, eventType },
            "[STRIPE_WEBHOOK] Failed to persist StripeEvent to DB idempotency ledger"
        );
        return "error";
    }
}

/**
 * Check whether a Stripe event has already been processed and persisted
 * to the DB idempotency ledger.
 *
 * Returns true if a StripeEvent row exists for this eventId. Uses
 * `withPlatform()` for RLS bypass (cross-tenant webhook context).
 */
async function isStripeEventProcessed(eventId: string): Promise<boolean> {
    try {
        const existing = await withPlatform((db) =>
            db.stripeEvent.findUnique({
                where: { eventId },
                select: { id: true },
            })
        );
        return existing !== null;
    } catch (err: unknown) {
        // If the DB check itself fails (DB down, network error, etc.),
        // we cannot safely determine whether the event was processed.
        // Return false so the caller proceeds with the Redis fast-path
        // claim — but the durable write at the end of processing will
        // fail and cause a 500 → Stripe retry, which is the safe
        // behaviour.
        billingLogger.warn(
            { err: err, eventId },
            "[STRIPE_WEBHOOK] DB idempotency check failed; falling through to Redis fast-path"
        );
        return false;
    }
}

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
        billingLogger.error({ err: err }, "[STRIPE_WEBHOOK] Signature verification failed:");
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
        );
    }

    billingLogger.info(`[STRIPE_WEBHOOK] Received: ${event.type}`);

    // ── DB-backed idempotency check (source of truth) ──────────────
    // If the event has already been persisted to the StripeEvent ledger,
    // short-circuit before doing any other work. This is what prevents
    // reprocessing after Redis eviction (memory pressure, restart).
    if (await isStripeEventProcessed(event.id)) {
        billingLogger.info(
            `[STRIPE_WEBHOOK] Duplicate event skipped (DB ledger): ${event.id}`
        );
        return NextResponse.json({ received: true, duplicate: true });
    }

    // ── Redis fast-path claim (prevents concurrent processing) ─────
    // Two concurrent deliveries of the same event (e.g. Stripe retry
    // racing the original) would both pass the DB check above. Redis
    // NX with a 10-minute TTL ensures only one worker proceeds.
    const eventClaimed = await claimStripeEvent(event.id);
    if (!eventClaimed) {
        billingLogger.info(`[STRIPE_WEBHOOK] Duplicate event skipped (Redis concurrent): ${event.id}`);
        return NextResponse.json({ received: true, concurrent: true });
    }

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
                billingLogger.info(
                    `[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`
                );
        }
    } catch (error) {
        billingLogger.error({ err: error }, `[STRIPE_WEBHOOK] Handler error for ${event.type}:`);
        await releaseStripeEventClaim(event.id);
        return NextResponse.json(
            { error: "Webhook handler failed", eventType: event.type },
            { status: 500 }
        );
    }

    // ── Persist to DB idempotency ledger (source of truth) ─────────
    // After successful processing, persist the event id. If this fails
    // for any reason other than P2002 race-condition, we must NOT mark
    // Redis as processed — otherwise the event would be lost after
    // Redis eviction and never retried. Return 500 → Stripe retries.
    const persistResult = await persistStripeEvent(event.id, event.type);
    if (persistResult === "error") {
        await releaseStripeEventClaim(event.id);
        return NextResponse.json(
            { error: "Failed to persist event idempotency record" },
            { status: 500 }
        );
    }

    // ── Extend Redis TTL (30-day cache for fast path) ─────────────
    await markStripeEventProcessed(event.id);

    if (persistResult === "duplicate") {
        // Another worker already persisted — still success, just note it.
        return NextResponse.json({ received: true, duplicate: true });
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
        billingLogger.error("[STRIPE_WEBHOOK] No organizationId in checkout metadata");
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

    billingLogger.info(
        `[STRIPE_WEBHOOK] Checkout completed for org: ${organizationId}`
    );
}

/**
 * invoice.payment_succeeded
 * Called when an invoice is paid. Updates subscription period.
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const stripeSubId = getSubscriptionIdFromInvoice(invoice);
    if (!stripeSubId) return;

    const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: stripeSubId },
    });

    if (!subscription) {
        billingLogger.error(
            `[STRIPE_WEBHOOK] No subscription found for Stripe sub: ${stripeSubId}`
        );
        return;
    }

    // Idempotency check — don't create duplicate invoices
    const existingInvoice = await prisma.invoice.findFirst({
        where: { stripeInvoiceId: invoice.id },
    });

    if (existingInvoice) {
        billingLogger.info(`[STRIPE_WEBHOOK] Invoice ${invoice.id} already recorded`);
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

    billingLogger.info(
        `[STRIPE_WEBHOOK] Payment succeeded for org: ${subscription.organizationId}`
    );
}

/**
 * invoice.payment_failed
 * Called when a payment attempt fails. Starts the grace period cascade.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const stripeSubId = getSubscriptionIdFromInvoice(invoice);
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

        billingLogger.info(
            `[STRIPE_WEBHOOK] SUSPENDED org: ${subscription.organizationId} (payment failed ${attemptCount} times)`
        );
    } else {
        // WARN — Day 0-6
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: "past_due" },
        });

        billingLogger.info(
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

            billingLogger.info(
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

    billingLogger.info(
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

    billingLogger.info(
        `[STRIPE_WEBHOOK] Trial ending in 3 days for org: ${subscription.organizationId}`
    );

    // Send trial ending notification email to org admin
    try {
        const org = await prisma.organization.findUnique({
            where: { id: subscription.organizationId },
            select: { name: true },
        });
        const adminUser = await prisma.user.findFirst({
            where: { organizationId: subscription.organizationId, role: "admin" },
            select: { email: true, name: true },
        });
        if (adminUser?.email) {
            const { sendTemplateEmail } = await import("@/lib/email");
            await sendTemplateEmail(adminUser.email, "trialEnding", {
                userName: adminUser.name || "Admin",
                orgName: org?.name || "your organization",
                daysLeft: 3,
            });
            billingLogger.info(
                `[STRIPE_WEBHOOK] Trial ending email sent to ${adminUser.email}`
            );
        }
    } catch (emailErr) {
        billingLogger.error({ err: emailErr }, "[STRIPE_WEBHOOK] Failed to send trial ending email");
    }
}
