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

import { assertRedisConnectionForWorkers } from "@/lib/redis";
import { eventLogger } from "@/lib/logger";

type WorkerHandle = {
    close: () => Promise<void>;
};

async function main() {
    eventLogger.info("═══════════════════════════════════════════");
    eventLogger.info("  PeopleFlow Worker Process Starting...");
    eventLogger.info("═══════════════════════════════════════════");

    await assertRedisConnectionForWorkers();

    // ── Import ALL workers (side-effect: starts BullMQ consumers) ──────

    const [
        { registerCronJobs },
        { eventWorker },
        { default: subscriptionWorker },
        { default: impersonationWorker },
        { default: usageTrackingWorker },
        { default: biometricSyncWorker },
        { default: deviceHealthWorker },
        { default: reconciliationWorker },
    ] = await Promise.all([
        import("@/lib/queue"),
        import("./event-worker"),
        import("./subscription-lifecycle"),
        import("./impersonation-cleanup"),
        import("./usage-tracking"),
        import("./biometric-sync"),
        import("./device-health"),
        import("./attendance-reconciliation"),
    ]);

    // ── Worker Registry (for shutdown orchestration) ───────────────────

    const allWorkers: Array<{ name: string; worker: WorkerHandle }> = [
        { name: "event-pipeline", worker: eventWorker },
        { name: "subscription-lifecycle", worker: subscriptionWorker },
        { name: "impersonation-cleanup", worker: impersonationWorker },
        { name: "usage-tracking", worker: usageTrackingWorker },
        { name: "biometric-sync", worker: biometricSyncWorker },
        { name: "device-health", worker: deviceHealthWorker },
        { name: "attendance-reconciliation", worker: reconciliationWorker },
    ];

    eventLogger.info(
        { workers: allWorkers.map((w) => w.name) },
        `All ${allWorkers.length} workers registered. Listening for jobs...`
    );

    // ── Register CRON schedules ────────────────────────────────────────

    registerCronJobs().catch((err) => {
        eventLogger.error({ err }, "Failed to register CRON jobs");
    });

    // ── Graceful Shutdown ──────────────────────────────────────────────

    const shutdown = async (signal: string) => {
        eventLogger.info(`Received ${signal}. Shutting down ${allWorkers.length} workers...`);

        const results = await Promise.allSettled(
            allWorkers.map(async ({ name, worker }) => {
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
}

main().catch((err) => {
    eventLogger.fatal({ err }, "Worker process failed to start");
    process.exit(1);
});
