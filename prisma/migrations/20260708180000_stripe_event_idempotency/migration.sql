-- CreateTable: StripeEvent (DB-backed Stripe webhook idempotency)
--
-- Purpose:
--   Stripe webhook idempotency previously relied solely on Redis. If Redis
--   evicted the key (memory pressure, restart, etc.), the same event could
--   be reprocessed — leading to duplicate invoices, double subscription
--   updates, duplicate audit logs, and so on.
--
--   This table is the durable source of truth. The Redis layer remains as
--   a fast-path cache to prevent concurrent processing within the
--   10-minute processing window, but the DB row is what prevents
--   reprocessing after Redis eviction.
--
-- Design:
--   * `eventId` is the unique Stripe event id (e.g. "evt_1Pabc...") used
--     for the INSERT ... ON CONFLICT DO NOTHING race-safe upsert.
--   * `eventType` is indexed so we can quickly query "how many
--     invoice.payment_succeeded events have we seen for this sub".
--   * `processedAt` and `status` are kept for ops/observability — the
--     webhook handler only ever inserts with status='processed', but
--     having the column in place lets future extensions record failed /
--     retried events without another migration.
--
-- RLS:
--   Stripe webhooks are cross-tenant (no organization context). The
--   handler writes via withPlatform() (RLS bypass), and the table is
--   intentionally not linked to Organization — it is a platform-level
--   idempotency ledger.

CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'processed',

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeEvent_eventId_key" ON "StripeEvent"("eventId");

CREATE INDEX "StripeEvent_eventType_idx" ON "StripeEvent"("eventType");
