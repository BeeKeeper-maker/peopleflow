/**
 * ═══════════════════════════════════════════════════════════════════
 * STRIPE WEBHOOK IDEMPOTENCY TESTS (P13-STRIPE-S3-I18N)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Regression coverage for the 3-layer idempotency implemented in
 * `src/app/api/webhooks/stripe/route.ts` (P12-IDEMPOTENCY-2 commit
 * 90d7245):
 *
 *   1. DB check  (source of truth — `StripeEvent` ledger)
 *   2. Redis claim (fast path — 10-min concurrent-processing lock)
 *   3. DB insert  (P2002 → duplicate, anything else → 500 + retry)
 *
 * Five scenarios:
 *   a) Duplicate event already in DB     → 200 `{ received: true, duplicate: true }`
 *   b) New event processes successfully  → 200 `{ received: true }`
 *   c) Race condition (P2002 on insert)  → 200 `{ received: true, duplicate: true }`
 *   d) DB write failure (non-P2002)      → 500 (Stripe will retry)
 *   e) Invalid signature                → 400
 *
 * Determinism: every external dependency is mocked — no real DB,
 * Redis, or Stripe SDK is touched. The global prisma mock in
 * `setup.ts` (now extended with `stripeEvent`) backs the
 * `withPlatform((db) => db.stripeEvent.*)` calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mocks (hoisted by vitest) ────────────────────────────────
// Mock the Stripe SDK wrapper BEFORE importing the route so the route's
// `verifyWebhookSignature` import resolves to our stub. Per-test override
// is done via vi.mocked(verifyWebhookSignature).mockResolvedValueOnce(...)
// or .mockImplementationOnce(...).
vi.mock("@/lib/stripe", () => ({
    verifyWebhookSignature: vi.fn(),
    generateInvoiceNumber: vi.fn((n: number) => `INV-${n}`),
}));

// Mock the Redis client. The route imports `getRedis` (used inside the
// local claimStripeEvent / markStripeEventProcessed / releaseStripeEventClaim
// helpers) plus `invalidateSubscription` / `invalidateOrgStatus` (used by
// the event handlers — none of which fire for the unhandled event type we
// use in scenarios b–d, but they must resolve cleanly if the route module
// is loaded).
vi.mock("@/lib/redis", () => {
    const redisInstance = {
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
    };
    return {
        getRedis: vi.fn(() => redisInstance),
        invalidateSubscription: vi.fn().mockResolvedValue(undefined),
        invalidateOrgStatus: vi.fn().mockResolvedValue(undefined),
    };
});

// ── Imports under test ─────────────────────────────────────────────
import { POST } from "@/app/api/webhooks/stripe/route";
import { verifyWebhookSignature } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

const EVENT_ID = "evt_test_001";
const EVENT_TYPE = "test.event.unhandled"; // hits the default case — no handler DB calls

/** Build a NextRequest that looks like a real Stripe webhook delivery. */
function makeWebhookRequest(body: string, signature = "t=1234,v1=deadbeef"): NextRequest {
    return new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body,
        headers: {
            "Content-Type": "text/plain",
            "stripe-signature": signature,
        },
    });
}

/** Build a minimal Stripe.Event shape that the route only reads .id + .type from. */
function makeStripeEvent(id: string = EVENT_ID, type: string = EVENT_TYPE) {
    return { id, type, data: { object: {} } } as never;
}

/**
 * Build a Stripe.Event whose `data.object` is the supplied payload.
 * Used by the event-handler tests (P14-TESTS) so each handler receives
 * a realistically-shaped Session / Invoice / Subscription object.
 */
function makeStripeEventWithObject(id: string, type: string, object: unknown) {
    return { id, type, data: { object } } as never;
}

// ═══════════════════════════════════════════════════════════════════
// Stripe Webhook Idempotency
// ═══════════════════════════════════════════════════════════════════

describe("[P13-STRIPE] Stripe webhook DB idempotency", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: signature verification succeeds with our fake event.
        // NOTE: verifyWebhookSignature is SYNCHRONOUS in the real Stripe lib
        // (returns Stripe.Event, not Promise<Stripe.Event>), and the route
        // calls it without await. Use mockReturnValue (not mockResolvedValue)
        // so the route gets a real Stripe.Event object back.
        vi.mocked(verifyWebhookSignature).mockReturnValue(makeStripeEvent());
        // Default: DB has no record of the event (new event path).
        vi.mocked(prisma.stripeEvent.findUnique).mockResolvedValue(null as never);
        // Default: DB insert succeeds.
        vi.mocked(prisma.stripeEvent.create).mockResolvedValue({ id: "row-1" } as never);
    });

    // ── a) Duplicate event already in DB ──────────────────────────
    it("returns { received: true, duplicate: true } when event already in DB ledger", async () => {
        // findUnique returns an existing row → isStripeEventProcessed() returns true
        vi.mocked(prisma.stripeEvent.findUnique).mockResolvedValue({
            id: "existing-row",
            eventId: EVENT_ID,
        } as never);

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({ received: true, duplicate: true });

        // Critical: event must NOT be processed. The Redis claim must NOT be
        // attempted, the handler switch must NOT run, and most importantly
        // the durable DB insert must NOT happen (it would either duplicate
        // the row or be a no-op, but in either case is wasted work).
        expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
    });

    // ── b) New event processes successfully ───────────────────────
    it("returns { received: true } for a new event and persists to DB ledger", async () => {
        // findUnique → null (default), create → success (default)

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({ received: true });

        // Verify the event id was durably persisted after processing.
        expect(prisma.stripeEvent.create).toHaveBeenCalledTimes(1);
        expect(prisma.stripeEvent.create).toHaveBeenCalledWith({
            data: { eventId: EVENT_ID, eventType: EVENT_TYPE },
        });
    });

    // ── c) Race condition (P2002 on create) ───────────────────────
    it("returns { received: true, duplicate: true } on P2002 race condition", async () => {
        // Simulate a concurrent worker beating us to the insert.
        // The DB check passed (null), the Redis claim passed, the handler
        // ran, then the durable insert raised P2002.
        const prismaError = Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
        });
        vi.mocked(prisma.stripeEvent.create).mockRejectedValue(prismaError as never);

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({ received: true, duplicate: true });

        // The create was attempted exactly once (not retried).
        expect(prisma.stripeEvent.create).toHaveBeenCalledTimes(1);
    });

    // ── d) DB write failure (non-P2002) ───────────────────────────
    it("returns 500 on non-P2002 DB write failure so Stripe retries", async () => {
        // Simulate a real DB outage (e.g. connection lost mid-write).
        // We must NOT mark Redis as processed and must return 500 so Stripe
        // retries the delivery; otherwise the event would be lost after
        // Redis eviction.
        vi.mocked(prisma.stripeEvent.create).mockRejectedValue(
            new Error("Connection terminated") as never,
        );

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toMatch(/persist/i);

        // Create was attempted exactly once.
        expect(prisma.stripeEvent.create).toHaveBeenCalledTimes(1);
    });

    // ── e) Invalid signature ──────────────────────────────────────
    it("returns 400 on invalid signature", async () => {
        // Stripe SDK throws when the signature does not match the body.
        vi.mocked(verifyWebhookSignature).mockImplementation(() => {
            throw new Error("No signatures found matching the expected signature for payload");
        });

        const res = await POST(makeWebhookRequest("tampered-body"));

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toMatch(/signature/i);

        // Critical: must NOT touch the DB ledger at all on a bad signature —
        // the request is unauthenticated and could be an attacker probing.
        expect(prisma.stripeEvent.findUnique).not.toHaveBeenCalled();
        expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// Stripe Webhook Event Handlers (P14-TESTS)
// ═══════════════════════════════════════════════════════════════════
//
// P13's tests above cover the 3-layer idempotency envelope but route
// every event to the `default` switch branch (unhandled event type) so
// the per-handler DB logic is never exercised. This block routes real
// event types through the POST endpoint and asserts the internal
// handlers (handleCheckoutCompleted / handlePaymentSucceeded /
// handlePaymentFailed / handleSubscriptionDeleted) make the correct
// Prisma calls.
//
// The handlers are NOT exported from the route module, so we drive them
// through the public POST entry point: verifyWebhookSignature is mocked
// per-test to return an event with the right type + data.object shape.
//
// Scenarios:
//   a) checkout.session.completed       → subscription.status = "active"
//   b) invoice.payment_succeeded        → invoice.create + subscription.update
//   c) invoice.payment_failed (attempt 1) → subscription.status = "past_due"
//   d) customer.subscription.deleted    → subscription.status = "canceled"
//   e) unknown event type               → 200 { received: true } (no crash)
//   f) handler throws                   → 500 (Stripe retries), claim released

describe("[P14-TESTS] Stripe webhook event handlers", () => {
    // Shared fake IDs — keep them stable across tests so the assertions read clean.
    const ORG_ID = "org-handler-1";
    const SUB_DB_ID = "sub-db-1";
    const STRIPE_SUB_ID = "sub_stripe_abc";
    const STRIPE_CUS_ID = "cus_stripe_xyz";

    beforeEach(() => {
        vi.clearAllMocks();

        // ── Idempotency envelope defaults (same as P13 block) ──────
        // verifyWebhookSignature is overridden in each test via mockReturnValue.
        vi.mocked(prisma.stripeEvent.findUnique).mockResolvedValue(null as never);
        vi.mocked(prisma.stripeEvent.create).mockResolvedValue({ id: "row-1" } as never);

        // ── Handler-layer Prisma defaults ──────────────────────────
        // subscription lookups: by default return a linked subscription so
        // the handlers proceed past their early-return guards. Tests that
        // need a missing-subscription path override locally.
        const subRow = { id: SUB_DB_ID, organizationId: ORG_ID, stripeSubscriptionId: STRIPE_SUB_ID };
        vi.mocked(prisma.subscription.findUnique).mockResolvedValue(subRow as never);
        vi.mocked(prisma.subscription.findFirst).mockResolvedValue(subRow as never);
        vi.mocked(prisma.subscription.update).mockResolvedValue(subRow as never);

        // invoice lookups: by default "not already recorded" so handlers
        // create a new invoice row.
        vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null as never);
        vi.mocked(prisma.invoice.count).mockResolvedValue(0 as never);
        vi.mocked(prisma.invoice.create).mockResolvedValue({ id: "inv-db-1" } as never);

        // plan lookup: by default no matching plan (handleSubscriptionUpdated
        // not asserted here, but stub keeps the module loadable).
        vi.mocked(prisma.plan.findFirst).mockResolvedValue(null as never);

        // organization.update: resolves cleanly (used by checkout + payment handlers).
        vi.mocked(prisma.organization.update).mockResolvedValue({ id: ORG_ID } as never);
    });

    // ── a) checkout.session.completed → subscription activated ────
    it("activates the subscription + organization on checkout.session.completed", async () => {
        vi.mocked(verifyWebhookSignature).mockReturnValue(
            makeStripeEventWithObject(
                "evt_checkout_001",
                "checkout.session.completed",
                {
                    metadata: { organizationId: ORG_ID },
                    subscription: STRIPE_SUB_ID,
                    customer: STRIPE_CUS_ID,
                },
            ),
        );

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: true });

        // Subscription is flipped to "active" and linked to Stripe IDs.
        expect(prisma.subscription.update).toHaveBeenCalledWith({
            where: { id: SUB_DB_ID },
            data: {
                status: "active",
                stripeCustomerId: STRIPE_CUS_ID,
                stripeSubscriptionId: STRIPE_SUB_ID,
            },
        });
        // Organization is also activated.
        expect(prisma.organization.update).toHaveBeenCalledWith({
            where: { id: ORG_ID },
            data: { status: "active" },
        });
    });

    // ── b) invoice.payment_succeeded → invoice record created ─────
    it("records a paid invoice and extends the subscription period on invoice.payment_succeeded", async () => {
        vi.mocked(verifyWebhookSignature).mockReturnValue(
            makeStripeEventWithObject(
                "evt_payok_001",
                "invoice.payment_succeeded",
                {
                    id: "in_stripe_001",
                    parent: { subscription_details: { subscription: STRIPE_SUB_ID } },
                    amount_paid: 50000, // 500.00 BDT (poisha)
                    currency: "bdt",
                    period_start: 1700000000,
                    period_end: 1702592000,
                    due_date: 1702592000,
                },
            ),
        );

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: true });

        // An invoice row must be created with the Stripe invoice id + paid status.
        expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
        expect(prisma.invoice.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    stripeInvoiceId: "in_stripe_001",
                    status: "paid",
                    amount: 50000,
                    currency: "BDT",
                    subscriptionId: SUB_DB_ID,
                    paymentMethod: "card",
                }),
            }),
        );

        // Subscription is extended inside the same $transaction.
        expect(prisma.subscription.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: SUB_DB_ID },
                data: expect.objectContaining({ status: "active" }),
            }),
        );
    });

    // ── c) invoice.payment_failed (attempt 1) → past_due ──────────
    it("marks the subscription past_due on the first invoice.payment_failed attempt", async () => {
        vi.mocked(verifyWebhookSignature).mockReturnValue(
            makeStripeEventWithObject(
                "evt_payfail_001",
                "invoice.payment_failed",
                {
                    id: "in_stripe_002",
                    parent: { subscription_details: { subscription: STRIPE_SUB_ID } },
                    attempt_count: 1, // first failure — WARN path, not SUSPEND
                    amount_due: 50000,
                    currency: "bdt",
                    last_finalization_error: { message: "Your card was declined." },
                    period_start: 1700000000,
                    period_end: 1702592000,
                    due_date: 1702592000,
                },
            ),
        );

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: true });

        // A failed invoice row is recorded.
        expect(prisma.invoice.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    stripeInvoiceId: "in_stripe_002",
                    status: "failed",
                    amount: 50000,
                    failureReason: "Your card was declined.",
                }),
            }),
        );

        // Subscription is marked past_due (NOT suspended — attempt_count < 3).
        expect(prisma.subscription.update).toHaveBeenCalledWith({
            where: { id: SUB_DB_ID },
            data: { status: "past_due" },
        });
    });

    // ── d) customer.subscription.deleted → canceled ───────────────
    it("marks the subscription canceled on customer.subscription.deleted", async () => {
        vi.mocked(verifyWebhookSignature).mockReturnValue(
            makeStripeEventWithObject(
                "evt_subdel_001",
                "customer.subscription.deleted",
                { id: STRIPE_SUB_ID },
            ),
        );

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: true });

        // Subscription is flipped to canceled. Org is NOT suspended here —
        // a 30-day grace CRON handles deactivation.
        expect(prisma.subscription.update).toHaveBeenCalledWith({
            where: { id: SUB_DB_ID },
            data: { status: "canceled" },
        });
    });

    // ── e) Unknown event type → 200 (no crash) ────────────────────
    it("returns 200 { received: true } for an unhandled event type without crashing", async () => {
        vi.mocked(verifyWebhookSignature).mockReturnValue(
            makeStripeEventWithObject(
                "evt_unknown_001",
                "customer.discount.created", // not in the switch — hits default
                { id: "di_123" },
            ),
        );

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: true });

        // No handler DB calls should have fired — only the idempotency ledger write.
        expect(prisma.subscription.update).not.toHaveBeenCalled();
        expect(prisma.invoice.create).not.toHaveBeenCalled();
        expect(prisma.organization.update).not.toHaveBeenCalled();
        // The event id IS persisted to the idempotency ledger (so we don't retry).
        expect(prisma.stripeEvent.create).toHaveBeenCalledTimes(1);
    });

    // ── f) Handler error → 500 (Stripe retries) ───────────────────
    it("returns 500 and releases the Redis claim when a handler throws", async () => {
        vi.mocked(verifyWebhookSignature).mockReturnValue(
            makeStripeEventWithObject(
                "evt_handler_err_001",
                "checkout.session.completed",
                {
                    metadata: { organizationId: ORG_ID },
                    subscription: STRIPE_SUB_ID,
                    customer: STRIPE_CUS_ID,
                },
            ),
        );
        // Force the handler to throw — simulates a transient DB outage.
        vi.mocked(prisma.subscription.findUnique).mockRejectedValue(
            new Error("Connection terminated") as never,
        );

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toMatch(/handler failed/i);
        expect(json.eventType).toBe("checkout.session.completed");

        // Critical: on handler failure the durable idempotency row must NOT
        // be persisted — otherwise Stripe would never retry and the event
        // would be silently lost.
        expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════
// Stripe Webhook Retry-Success (P17-BUGS-7)
// ═══════════════════════════════════════════════════════════════════
//
// Regression coverage for the retry-success path on
// `invoice.payment_succeeded`. When a payment fails first then succeeds
// on retry, Stripe sends a NEW `invoice.payment_succeeded` event for
// the SAME invoice id. The previous implementation looked up the
// existing invoice row, saw it existed (with status "failed"), and
// returned early — leaving the invoice stuck at "failed" forever and
// never extending the subscription's currentPeriodEnd.
//
// P17-BUGS-7 fix: when the existing invoice has status "failed", flip
// it to "paid" and extend the subscription period in a single
// transaction.

describe("[P17-BUGS-7] Stripe webhook retry-success on failed invoice", () => {
    const ORG_ID = "org-retry-1";
    const SUB_DB_ID = "sub-retry-1";
    const STRIPE_SUB_ID = "sub_stripe_retry";
    const STRIPE_INVOICE_ID = "in_stripe_retry_001";
    const FAILED_INVOICE_DB_ID = "inv-failed-1";

    beforeEach(() => {
        vi.clearAllMocks();

        // Idempotency envelope defaults — event is new.
        vi.mocked(prisma.stripeEvent.findUnique).mockResolvedValue(null as never);
        vi.mocked(prisma.stripeEvent.create).mockResolvedValue({ id: "row-1" } as never);

        // Subscription lookup returns a linked sub so the handler proceeds.
        const subRow = {
            id: SUB_DB_ID,
            organizationId: ORG_ID,
            stripeSubscriptionId: STRIPE_SUB_ID,
        };
        vi.mocked(prisma.subscription.findFirst).mockResolvedValue(subRow as never);
        vi.mocked(prisma.subscription.update).mockResolvedValue(subRow as never);

        // Critical mock: the invoice ALREADY EXISTS with status "failed".
        // This is the state left behind by the prior `invoice.payment_failed`
        // webhook. The retry-success handler must UPDATE this row to "paid".
        vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
            id: FAILED_INVOICE_DB_ID,
            stripeInvoiceId: STRIPE_INVOICE_ID,
            status: "failed",
            subscriptionId: SUB_DB_ID,
        } as never);

        vi.mocked(prisma.organization.update).mockResolvedValue({ id: ORG_ID } as never);
    });

    it("flips a previously-failed invoice to paid on retry-success and extends the subscription", async () => {
        vi.mocked(verifyWebhookSignature).mockReturnValue(
            makeStripeEventWithObject(
                "evt_retry_success_001",
                "invoice.payment_succeeded",
                {
                    id: STRIPE_INVOICE_ID,
                    parent: { subscription_details: { subscription: STRIPE_SUB_ID } },
                    amount_paid: 50000, // 500.00 BDT (poisha)
                    currency: "bdt",
                    period_start: 1700000000,
                    period_end: 1702592000,
                    due_date: 1702592000,
                },
            ),
        );

        const res = await POST(makeWebhookRequest("{}"));

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ received: true });

        // Critical: the existing failed invoice is UPDATED to "paid", not
        // skipped. A new invoice row must NOT be created.
        expect(prisma.invoice.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: FAILED_INVOICE_DB_ID },
                data: expect.objectContaining({
                    status: "paid",
                    paidAt: expect.any(Date),
                    failureReason: null,
                }),
            }),
        );
        expect(prisma.invoice.create).not.toHaveBeenCalled();

        // The subscription is reactivated + extended inside the same $transaction.
        expect(prisma.subscription.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: SUB_DB_ID },
                data: expect.objectContaining({
                    status: "active",
                    currentPeriodEnd: expect.any(Date),
                }),
            }),
        );

        // The org is restored to active in case it had been suspended.
        expect(prisma.organization.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: ORG_ID },
                data: expect.objectContaining({
                    status: "active",
                    suspendedAt: null,
                    suspendedReason: null,
                }),
            }),
        );
    });
});

// ═══════════════════════════════════════════════════════════════════
// Stripe Webhook Subscription Lock (P17-BUGS-6)
// ═══════════════════════════════════════════════════════════════════
//
// When two DIFFERENT Stripe events for the SAME subscription arrive
// concurrently (e.g. `invoice.payment_succeeded` and
// `customer.subscription.updated`), both handlers call
// `prisma.subscription.update` on the same row. Without serialization
// this causes lost updates or P2034 write conflicts.
//
// P17-BUGS-6 fix: acquire a Redis lock keyed by `stripe:sub:${subId}`
// before running any handler that touches a subscription. If the lock
// cannot be acquired, return 503 so Stripe retries after the other
// worker finishes. Do NOT persist the StripeEvent row in that case.

describe("[P17-BUGS-6] Stripe webhook per-subscription lock", () => {
    const STRIPE_SUB_ID = "sub_stripe_lock_001";

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.stripeEvent.findUnique).mockResolvedValue(null as never);
        vi.mocked(prisma.stripeEvent.create).mockResolvedValue({ id: "row-1" } as never);
    });

    it("returns 503 when the subscription lock is held by another worker and does NOT persist the event", async () => {
        // Mock Redis: the event-id claim succeeds (returns "OK"), but the
        // subscription-id lock fails on both attempts (returns null).
        // This simulates another worker already mid-flight on the same
        // subscription id.
        const redisSet = vi.fn().mockImplementation((key: string) => {
            if (key.startsWith("stripe:event:")) return Promise.resolve("OK");
            // stripe:sub:* — both the first attempt and the 2-second retry
            // fail to acquire the lock.
            return Promise.resolve(null);
        });
        const redisDel = vi.fn().mockResolvedValue(1);
        const redisModule = await import("@/lib/redis");
        vi.mocked(redisModule.getRedis).mockReturnValue({
            set: redisSet,
            del: redisDel,
        } as never);

        // Stub the 2-second retry-delay so the test doesn't actually sleep.
        vi.useFakeTimers();
        try {
            vi.mocked(verifyWebhookSignature).mockReturnValue(
                makeStripeEventWithObject(
                    "evt_lock_contention_001",
                    "customer.subscription.updated",
                    { id: STRIPE_SUB_ID },
                ),
            );

            // Kick off POST and fast-forward through the setTimeout retry delay.
            const postPromise = POST(makeWebhookRequest("{}"));
            await vi.advanceTimersByTimeAsync(2500);
            const res = await postPromise;

            expect(res.status).toBe(503);
            const json = await res.json();
            expect(json.error).toMatch(/lock contention/i);

            // Critical: the event-id claim must be released so Stripe's retry
            // is NOT treated as a duplicate by the Redis fast path.
            expect(redisDel).toHaveBeenCalledWith(`stripe:event:evt_lock_contention_001`);

            // The StripeEvent row must NOT be persisted — otherwise Stripe's
            // retry would be treated as a duplicate and the update lost.
            expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});

