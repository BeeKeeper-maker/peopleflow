/**
 * PeopleFlow Worker Process — Entry Point
 *
 * Starts ALL BullMQ workers. Run as a separate container:
 *   docker-compose service: worker
 *   command: npm run worker
 *
 * Workers started:
 *   1. event-worker         — Notification & email pipeline
 *   2. subscription-lifecycle — Trial expiry, suspensions, payment reminders
 *   3. impersonation-cleanup  — Auto-expire platform admin sessions
 *   4. usage-tracking         — Periodic tenant usage snapshots
 *   5. biometric-sync         — Device data synchronization
 *   6. device-health          — Biometric device heartbeat monitoring
 *   7. attendance-reconciliation — Daily attendance gap detection
 */

import { registerCronJobs } from "@/lib/queue";
import { eventLogger } from "@/lib/logger";

eventLogger.info("═══════════════════════════════════════════");
eventLogger.info("  PeopleFlow Worker Process Starting...");
eventLogger.info("═══════════════════════════════════════════");

// ── Import ALL workers (side-effect: starts BullMQ consumers) ──────

// Core event pipeline (notifications, emails, audit)
import { eventWorker } from "./event-worker";

// SaaS lifecycle workers
import subscriptionWorker from "./subscription-lifecycle";
import impersonationWorker from "./impersonation-cleanup";
import usageTrackingWorker from "./usage-tracking";

// Biometric & Attendance workers
import biometricSyncWorker from "./biometric-sync";
import deviceHealthWorker from "./device-health";
import reconciliationWorker from "./attendance-reconciliation";

// ── Worker Registry (for shutdown orchestration) ───────────────────

const ALL_WORKERS = [
    { name: "event-pipeline", worker: eventWorker },
    { name: "subscription-lifecycle", worker: subscriptionWorker },
    { name: "impersonation-cleanup", worker: impersonationWorker },
    { name: "usage-tracking", worker: usageTrackingWorker },
    { name: "biometric-sync", worker: biometricSyncWorker },
    { name: "device-health", worker: deviceHealthWorker },
    { name: "attendance-reconciliation", worker: reconciliationWorker },
];

eventLogger.info(
    { workers: ALL_WORKERS.map((w) => w.name) },
    `All ${ALL_WORKERS.length} workers registered. Listening for jobs...`
);

// ── Register CRON schedules ────────────────────────────────────────

registerCronJobs().catch((err) => {
    eventLogger.error({ err }, "Failed to register CRON jobs");
});

// ── Graceful Shutdown ──────────────────────────────────────────────

const shutdown = async (signal: string) => {
    eventLogger.info(`Received ${signal}. Shutting down ${ALL_WORKERS.length} workers...`);

    const results = await Promise.allSettled(
        ALL_WORKERS.map(async ({ name, worker }) => {
            try {
                await worker.close();
                eventLogger.info(`  ✓ ${name} stopped`);
            } catch (err) {
                eventLogger.error({ err }, `  ✗ ${name} failed to stop`);
            }
        })
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
        eventLogger.warn(`${failed} worker(s) failed to shut down cleanly`);
    }

    eventLogger.info("Workers shut down. Exiting.");
    process.exit(failed > 0 ? 1 : 0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
