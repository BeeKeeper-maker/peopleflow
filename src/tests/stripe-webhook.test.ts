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
