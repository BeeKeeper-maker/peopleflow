/**
 * Stripe Client — Enterprise Billing Integration
 *
 * Singleton Stripe client + helper functions for:
 * - Creating checkout sessions
 * - Managing subscriptions
 * - Webhook signature verification
 */

import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/**
 * Get or create the Stripe singleton
 */
export function getStripe(): Stripe {
    if (!stripeInstance) {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            throw new Error(
                "STRIPE_SECRET_KEY environment variable is not set. " +
                "Please configure Stripe credentials."
            );
        }

        stripeInstance = new Stripe(secretKey, {
            apiVersion: "2026-03-25.dahlia",
            typescript: true,
        });
    }
    return stripeInstance;
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
    payload: string | Buffer,
    signature: string
): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Create a Stripe Checkout Session for a new subscription
 */
export async function createCheckoutSession(params: {
    organizationId: string;
    organizationName: string;
    customerEmail: string;
    stripePriceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
}): Promise<Stripe.Checkout.Session> {
    const session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: params.customerEmail,
        line_items: [
            {
                price: params.stripePriceId,
                quantity: 1,
            },
        ],
        metadata: {
            organizationId: params.organizationId,
            organizationName: params.organizationName,
        },
        subscription_data: {
            metadata: {
                organizationId: params.organizationId,
            },
            ...(params.trialDays
                ? { trial_period_days: params.trialDays }
                : {}),
        },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
    });

    return session;
}

/**
 * Create a Stripe Customer Portal session (for managing billing)
 */
export async function createPortalSession(params: {
    stripeCustomerId: string;
    returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
    return getStripe().billingPortal.sessions.create({
        customer: params.stripeCustomerId,
        return_url: params.returnUrl,
    });
}

/**
 * Cancel a Stripe subscription at period end
 */
export async function cancelSubscription(
    stripeSubscriptionId: string,
    cancelImmediately: boolean = false
): Promise<Stripe.Subscription> {
    if (cancelImmediately) {
        return getStripe().subscriptions.cancel(stripeSubscriptionId);
    }

    return getStripe().subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
    });
}

/**
 * Update subscription to a new plan
 */
export async function updateSubscriptionPlan(
    stripeSubscriptionId: string,
    newStripePriceId: string
): Promise<Stripe.Subscription> {
    const subscription =
        await getStripe().subscriptions.retrieve(stripeSubscriptionId);

    return getStripe().subscriptions.update(stripeSubscriptionId, {
        items: [
            {
                id: subscription.items.data[0].id,
                price: newStripePriceId,
            },
        ],
        proration_behavior: "create_prorations",
    });
}

/**
 * Generate invoice number: INV-YYYY-NNNN
 */
export function generateInvoiceNumber(sequenceNumber: number): string {
    const year = new Date().getFullYear();
    const padded = String(sequenceNumber).padStart(4, "0");
    return `INV-${year}-${padded}`;
}
