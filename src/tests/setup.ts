/**
 * Vitest Setup File
 *
 * Runs before all test suites.
 * Sets up mocks and environment for unit testing.
 */

// Set test environment variables BEFORE any module imports
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/peopleflow_test";
process.env.REDIS_URL = "redis://localhost:6379/1"; // Use DB 1 for tests
process.env.NEXTAUTH_SECRET = "test-secret-32-characters-long!!";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock";
// P14-I18N-CRON-PF: cron-auth default-deny now requires either CRON_SECRET
// or ALLOW_INSECURE_CRON=1. Tests that hit /api/cron/* without a secret
// need this opt-in to pass.
process.env.ALLOW_INSECURE_CRON = "1";
(process.env as any).NODE_ENV = "test";

// ── Prisma Mock ─────────────────────────────────────────────────────
// Global mock for Prisma client — prevents DB connections during unit tests.
// Individual tests can override specific methods using vi.mocked().
//
// IMPORTANT: both `default` and the named `prisma` export point to the SAME
// mock object so that test code can use either import style:
//     import prisma from "@/lib/prisma"      // default
//     import { prisma } from "@/lib/prisma"  // named
// and still mutate / assert against the same mock function instances.
import { vi } from "vitest";

const prismaMock = {
    salaryStructureAssignment: { findFirst: vi.fn() },
    attendance: { findMany: vi.fn(), count: vi.fn() },
    leaveApplication: { findMany: vi.fn(), count: vi.fn() },
    loan: { findMany: vi.fn() },
    // P10-TESTS: system-stats route calls employee.count + approvalRequest.count
    employee: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    pFAccount: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    pFTransaction: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    festivalBonusConfig: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    festivalBonusPayment: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    lateDeductionPolicy: { findFirst: vi.fn() },
    organization: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    impersonationSession: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    leaveAllocation: { findMany: vi.fn() },
    // P10-TESTS: system-stats route counts pending approvals via approvalRequest.count
    approvalRequest: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    // P0 regression: 2FA disable + sessionVersion bump routes touch user.*
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    // P0 regression: bKash disbursement + payroll atomicity touch salarySlip.*
    salarySlip: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    // P0 regression: bKash disbursement creates & updates SalaryDisbursement
    salaryDisbursement: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    // P0 regression: final-settlement engine fetches org holidays
    holidayList: { findFirst: vi.fn() },
    // P0 regression: impersonation audit log + platform actions
    platformAuditLog: { create: vi.fn(), findMany: vi.fn() },
    // P12-AUDIT-STORAGE: tenant audit log (createAuditLog calls prisma.auditLog.create)
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    // P13-STRIPE: Stripe webhook DB idempotency ledger
    // Used by /api/webhooks/stripe/route.ts via withPlatform((db) => db.stripeEvent.*)
    stripeEvent: { findUnique: vi.fn(), create: vi.fn() },
    // P14-TESTS: Stripe webhook event handlers + health-alert probe
    // subscription.* — used by handleCheckoutCompleted / handlePaymentSucceeded /
    // handlePaymentFailed / handleSubscriptionUpdated / handleSubscriptionDeleted
    subscription: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    // invoice.* — used by handlePaymentSucceeded / handlePaymentFailed
    invoice: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    // plan.* — used by handleSubscriptionUpdated (plan change lookup)
    plan: { findFirst: vi.fn() },
    // $queryRaw — used by health-alert.ts DB probe (`SELECT 1`)
    $queryRaw: vi.fn(),
    // $transaction supports BOTH forms in Prisma:
    //   1. Callback form:  prisma.$transaction(async (tx) => { ... })
    //   2. Array form:      prisma.$transaction([query1, query2])
    // The array form is used by Stripe webhook handlers (e.g. handlePaymentSucceeded
    // creates an invoice + updates the subscription atomically). Detect the shape
    // and dispatch accordingly so neither form throws.
    $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === "function") {
            return (arg as (tx: unknown) => Promise<unknown>)(prismaMock);
        }
        return Promise.all(arg as Promise<unknown>[]);
    }),
};

vi.mock("@/lib/prisma", () => ({
    default: prismaMock,
    prisma: prismaMock,
    // Stub the RLS wrappers so tests that go through api-auth.withDB still
    // resolve to the same prisma mock. Real RLS enforcement is verified by
    // tenant-isolation.test.ts at the SQL migration level.
    withTenant: vi.fn(<T>(_orgId: string, fn: (db: unknown) => Promise<T>) => fn(prismaMock)),
    withPlatform: vi.fn(<T>(fn: (db: unknown) => Promise<T>) => fn(prismaMock)),
}));

// ── Logger Mock ─────────────────────────────────────────────────────
// Suppress all log output during tests
vi.mock("@/lib/logger", () => {
    const noopLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn(() => noopLogger),
    };
    return {
        log: noopLogger,
        payrollLogger: noopLogger,
        authLogger: noopLogger,
        queueLogger: noopLogger,
        billingLogger: noopLogger,
        biometricLogger: noopLogger,
        platformLogger: noopLogger,
        subscriptionLogger: noopLogger,
        attendanceLogger: noopLogger,
        emailLogger: noopLogger,
        redisLogger: noopLogger,
        eventLogger: noopLogger,
        apiLogger: noopLogger,
        auditLogger: noopLogger,
        cronLogger: noopLogger,
        storageLogger: noopLogger,
        exportLogger: noopLogger,
        leaveLogger: noopLogger,
        createRequestLogger: vi.fn(() => noopLogger),
    };
});
