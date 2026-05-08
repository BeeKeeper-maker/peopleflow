/**
 * BullMQ Queue Definitions & Job Scheduler
 *
 * Central queue registry for all background jobs.
 * Uses Redis as the backing store (same instance as caching).
 *
 * Queues:
 * - subscription-lifecycle: Trial expiry, payment reminders, suspension cascade, data cleanup
 * - impersonation-cleanup: Auto-expire active impersonation sessions
 * - usage-tracking: Record periodic usage snapshots per tenant
 * - notifications: Email dispatch (payment failed, trial ending, welcome)
 * - biometric-sync: Device data sync with exponential retry + DLQ classification
 * - device-health: Heartbeat monitoring for biometric devices
 * - attendance-reconciliation: Daily attendance gap detection
 */

import { Queue, type ConnectionOptions } from "bullmq";
import { queueLogger } from "@/lib/logger";
import { isRedisDisabledForRuntime } from "@/lib/redis";

// ── Redis Connection (shared with existing redis.ts) ──

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function parseRedisUrl(url: string): ConnectionOptions {
    const parsed = new URL(url);
    return {
        host: parsed.hostname || "localhost",
        port: parseInt(parsed.port || "6379"),
        password: parsed.password || undefined,
        db: parseInt(parsed.pathname?.slice(1) || "0"),
    };
}

export const redisConnection: ConnectionOptions = parseRedisUrl(REDIS_URL);

function createQueue<T = unknown>(
    name: string,
    options: ConstructorParameters<typeof Queue<T>>[1]
): Queue<T> {
    if (!isRedisDisabledForRuntime()) {
        return new Queue<T>(name, options);
    }

    return {
        name,
        add: async (jobName: string) => {
            queueLogger.debug({ queue: name, jobName }, "Queue disabled for this runtime; skipped enqueue");
            return { id: undefined };
        },
        upsertJobScheduler: async (schedulerId: string) => {
            queueLogger.debug({ queue: name, schedulerId }, "Queue disabled for this runtime; skipped scheduler");
            return undefined;
        },
        close: async () => undefined,
    } as unknown as Queue<T>;
}

// ── Queue Definitions ──

export const subscriptionQueue = createQueue<SubscriptionJobData>("subscription-lifecycle", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
        removeOnFail: { count: 5000 }, // Keep last 5000 failed jobs
    },
});

export const impersonationQueue = createQueue<ImpersonationJobData>("impersonation-cleanup", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 3000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
    },
});

export const usageTrackingQueue = createQueue<UsageTrackingJobData>("usage-tracking", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
    },
});

export const notificationQueue = createQueue<NotificationJobData>("notifications", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5, // Emails are critical, retry more
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 5000 },
    },
});

export const eventPipelineQueue = createQueue("event-pipeline", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 10_000 }, // 10s → 20s → 40s → 80s → 160s
        removeOnComplete: { count: 5000 },
        removeOnFail: { count: 10_000 }, // Keep failed events for DLQ analysis
    },
});

// ── Biometric Device Queues ──

export const biometricSyncQueue = createQueue<BiometricSyncJobData>("biometric-sync", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5, // Retry up to 5 times with exponential backoff
        backoff: { type: "exponential", delay: 15000 }, // 15s, 30s, 60s, 120s, 240s
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 10000 }, // Keep failed jobs for analysis
    },
});

export const deviceHealthQueue = createQueue<DeviceHealthJobData>("device-health", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 1, // Health checks don't retry — next scheduled ping will cover it
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
    },
});

export const attendanceReconciliationQueue = createQueue<ReconciliationJobData>("attendance-reconciliation", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
    },
});

// ── Job Type Definitions ──

export type SubscriptionJobType =
    | "check-trial-expiry"
    | "enforce-suspensions"
    | "send-payment-reminders"
    | "cleanup-deactivated-tenants"
    | "audit-plan-limits";

export type NotificationJobType =
    | "payment-failed"
    | "trial-ending"
    | "account-suspended"
    | "welcome-email"
    | "plan-changed";

export interface SubscriptionJobData {
    type: SubscriptionJobType;
    organizationId?: string;
    metadata?: Record<string, unknown>;
}

export interface ImpersonationJobData {
    type: "cleanup-expired";
}

export interface UsageTrackingJobData {
    type: "snapshot-all" | "snapshot-org";
    organizationId?: string;
}

export interface NotificationJobData {
    type: NotificationJobType;
    to: string;
    organizationId: string;
    data: Record<string, unknown>;
}

// ── Biometric Job Types ──

export type BiometricSyncJobType =
    | "sync-device"            // Sync a single device
    | "sync-all-org-devices"   // Sync all devices for an organization
    | "retry-failed-device";   // Retry a previously failed device sync

export interface BiometricSyncJobData {
    type: BiometricSyncJobType;
    deviceId?: string;
    organizationId?: string;
    attempt?: number;           // Current retry attempt
    previousError?: string;     // Error from previous attempt
}

export type DeviceHealthJobType =
    | "ping-all-devices"       // Ping all active devices
    | "ping-device";           // Ping a single device

export interface DeviceHealthJobData {
    type: DeviceHealthJobType;
    deviceId?: string;
    organizationId?: string;
}

export type ReconciliationJobType =
    | "daily-reconciliation"   // Check all orgs for attendance gaps
    | "org-reconciliation";    // Check a single org

export interface ReconciliationJobData {
    type: ReconciliationJobType;
    organizationId?: string;
    date?: string;              // ISO date string — defaults to yesterday
}

// ── CRON Schedule Registration ──
// Call this once on application startup

export async function registerCronJobs(): Promise<void> {
    queueLogger.info("Registering CRON jobs...");

    // Every 15 minutes: Clean up expired impersonation sessions
    await impersonationQueue.upsertJobScheduler(
        "impersonation-cleanup-cron",
        { pattern: "*/15 * * * *" },
        {
            name: "cleanup-expired",
            data: { type: "cleanup-expired" } as ImpersonationJobData,
        }
    );

    // Every hour: Check for expiring trials (3-day warning)
    await subscriptionQueue.upsertJobScheduler(
        "trial-expiry-check",
        { pattern: "0 * * * *" },
        {
            name: "check-trial-expiry",
            data: { type: "check-trial-expiry" } as SubscriptionJobData,
        }
    );

    // Every 6 hours: Enforce suspensions for past-due accounts
    await subscriptionQueue.upsertJobScheduler(
        "enforce-suspensions",
        { pattern: "0 */6 * * *" },
        {
            name: "enforce-suspensions",
            data: { type: "enforce-suspensions" } as SubscriptionJobData,
        }
    );

    // Every day at 9 AM: Send payment reminders
    await subscriptionQueue.upsertJobScheduler(
        "payment-reminders",
        { pattern: "0 9 * * *" },
        {
            name: "send-payment-reminders",
            data: { type: "send-payment-reminders" } as SubscriptionJobData,
        }
    );

    // Every day at 2 AM: Audit plan limits (safety net)
    await subscriptionQueue.upsertJobScheduler(
        "plan-limit-audit",
        { pattern: "0 2 * * *" },
        {
            name: "audit-plan-limits",
            data: { type: "audit-plan-limits" } as SubscriptionJobData,
        }
    );

    // Every 4 hours: Snapshot usage metrics for all tenants
    await usageTrackingQueue.upsertJobScheduler(
        "usage-snapshot",
        { pattern: "0 */4 * * *" },
        {
            name: "snapshot-all",
            data: { type: "snapshot-all" } as UsageTrackingJobData,
        }
    );

    // Every week (Monday 3 AM): Clean up deactivated tenants (30+ days)
    await subscriptionQueue.upsertJobScheduler(
        "cleanup-deactivated",
        { pattern: "0 3 * * 1" },
        {
            name: "cleanup-deactivated-tenants",
            data: {
                type: "cleanup-deactivated-tenants",
            } as SubscriptionJobData,
        }
    );

    // ── Biometric CRON Jobs ──

    // Every 5 minutes: Ping all active biometric devices (heartbeat)
    await deviceHealthQueue.upsertJobScheduler(
        "device-health-ping",
        { pattern: "*/5 * * * *" },
        {
            name: "ping-all-devices",
            data: { type: "ping-all-devices" } as DeviceHealthJobData,
        }
    );

    // Every day at 11 PM (BD time): Run attendance reconciliation for today
    await attendanceReconciliationQueue.upsertJobScheduler(
        "daily-attendance-reconciliation",
        { pattern: "0 23 * * *" },
        {
            name: "daily-reconciliation",
            data: { type: "daily-reconciliation" } as ReconciliationJobData,
        }
    );

    queueLogger.info("All CRON jobs registered (including biometric)");
}
