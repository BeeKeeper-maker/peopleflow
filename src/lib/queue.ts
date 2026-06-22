/**
 * BullMQ Queue Definitions & Job Scheduler
 *
 * Queues are created lazily so importing shared modules from the web server
 * does not eagerly open Redis/BullMQ connections. The worker process and
 * explicit enqueue/scheduler calls still get real queues on demand.
 */

import { Queue, type ConnectionOptions } from "bullmq";
import { queueLogger } from "@/lib/logger";
import { isRedisDisabledForRuntime } from "@/lib/redis";

// ── Redis Connection (shared with workers) ──

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

type QueueOptions<T> = ConstructorParameters<typeof Queue<T>>[1];

function createDisabledQueue<T = unknown>(name: string): Queue<T> {
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

function createLazyQueue<T = unknown>(name: string, options: QueueOptions<T>): Queue<T> {
    let queue: Queue<T> | null = null;

    const getQueue = () => {
        if (isRedisDisabledForRuntime()) {
            return createDisabledQueue<T>(name);
        }

        queue ??= new Queue<T>(name, options);
        return queue;
    };

    return new Proxy({} as Queue<T>, {
        get(_target, prop, receiver) {
            if (prop === "name") return name;
            const value = Reflect.get(getQueue(), prop, receiver);
            return typeof value === "function" ? value.bind(getQueue()) : value;
        },
    });
}

// ── Queue Definitions ──

export const subscriptionQueue = createLazyQueue<SubscriptionJobData>("subscription-lifecycle", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
    },
});

export const impersonationQueue = createLazyQueue<ImpersonationJobData>("impersonation-cleanup", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 3000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
    },
});

export const usageTrackingQueue = createLazyQueue<UsageTrackingJobData>("usage-tracking", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
    },
});

export const notificationQueue = createLazyQueue<NotificationJobData>("notifications", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 5000 },
    },
});

export const eventPipelineQueue = createLazyQueue("event-pipeline", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 5000 },
        removeOnFail: { count: 10_000 },
    },
});

export const biometricSyncQueue = createLazyQueue<BiometricSyncJobData>("biometric-sync", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 15000 },
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 10000 },
    },
});

export const deviceHealthQueue = createLazyQueue<DeviceHealthJobData>("device-health", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
    },
});

export const attendanceReconciliationQueue = createLazyQueue<ReconciliationJobData>("attendance-reconciliation", {
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

export type BiometricSyncJobType =
    | "sync-device"
    | "sync-all-org-devices"
    | "retry-failed-device";

export interface BiometricSyncJobData {
    type: BiometricSyncJobType;
    deviceId?: string;
    organizationId?: string;
    attempt?: number;
    previousError?: string;
}

export type DeviceHealthJobType =
    | "ping-all-devices"
    | "ping-device";

export interface DeviceHealthJobData {
    type: DeviceHealthJobType;
    deviceId?: string;
    organizationId?: string;
}

export type ReconciliationJobType =
    | "daily-reconciliation"
    | "org-reconciliation";

export interface ReconciliationJobData {
    type: ReconciliationJobType;
    organizationId?: string;
    date?: string;
}

// ── CRON Schedule Registration ──
// Call this once from the worker process.

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
