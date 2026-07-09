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
(process.env as any).NODE_ENV = "test";

// ── Prisma Mock ─────────────────────────────────────────────────────
// Global mock for Prisma client — prevents DB connections during unit tests.
// Individual tests can override specific methods using vi.mocked().
import { vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: {
        salaryStructureAssignment: { findFirst: vi.fn() },
        attendance: { findMany: vi.fn(), count: vi.fn() },
        leaveApplication: { findMany: vi.fn() },
        loan: { findMany: vi.fn() },
        employee: { findUnique: vi.fn(), findMany: vi.fn() },
        pFAccount: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
        pFTransaction: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
        festivalBonusConfig: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
        festivalBonusPayment: { findMany: vi.fn(), update: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
        lateDeductionPolicy: { findFirst: vi.fn() },
        organization: { findMany: vi.fn() },
        impersonationSession: { findMany: vi.fn(), updateMany: vi.fn() },
        leaveAllocation: { findMany: vi.fn() },
        $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({
            pFTransaction: { create: vi.fn() },
            pFAccount: { update: vi.fn() },
            festivalBonusPayment: { create: vi.fn() },
        })),
    },
    prisma: {
        // named export alias
    },
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
