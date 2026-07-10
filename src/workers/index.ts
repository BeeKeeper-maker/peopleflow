/**
 * Worker Entrypoint
 *
 * Starts all BullMQ workers and registers CRON job schedules.
 * Run separately from the Next.js app server:
 *
 *   npx tsx src/workers/index.ts
 *
 * In production, this runs as a separate Docker container
 * or Coolify service alongside the main Next.js app.
 */

import { assertRedisConnectionForWorkers } from "@/lib/redis";
import { log } from "@/lib/logger";

const workerLogger = log.child({ domain: "worker-service" });

async function main() {
    await assertRedisConnectionForWorkers();

    const { registerCronJobs } = await import("@/lib/queue");

    // Import workers to activate them after Redis is confirmed.
    await Promise.all([
        import("./event-worker"),           // Notification & email pipeline (was missing!)
        import("./subscription-lifecycle"),
        import("./impersonation-cleanup"),
        import("./usage-tracking"),
        import("./biometric-sync"),
        import("./device-health"),
        import("./attendance-reconciliation"),
    ]);

    workerLogger.info({
        startedAt: new Date().toISOString(),
        redisUrl: process.env.REDIS_URL ? "[redacted]" : "redis://localhost:6379",
        workers: ["event-pipeline", "subscription", "impersonation", "usage", "biometric-sync", "device-health", "reconciliation"],
    }, "PeopleFlow SaaS — Background Worker Service started");

    // Register CRON schedules
    await registerCronJobs();

    workerLogger.info("All workers started. Listening for jobs.");

    // Keep the process alive
    process.on("SIGTERM", async () => {
        workerLogger.info("Received SIGTERM. Gracefully shutting down.");
        process.exit(0);
    });

    process.on("SIGINT", async () => {
        workerLogger.info("Received SIGINT. Gracefully shutting down.");
        process.exit(0);
    });
}

main().catch((err) => {
    workerLogger.fatal({ err }, "Fatal worker error");
    process.exit(1);
});
